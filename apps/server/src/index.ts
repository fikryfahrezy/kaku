import { resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";
import {
  ProtocolErrorCode,
  MessageType,
  encodeServerMessage,
  parseClientMessage,
  DeliveryError,
  DeviceRole,
  type ServerMessage,
} from "@kaku/protocol";
import { PairingStore, type AuthenticatedDevice } from "./pairing-store";
import { RateLimiter } from "./rate-limiter";
import { clientAddress } from "./client-address";
import { RateLimitScope, rateLimitConfig } from "./config";

interface SocketData extends AuthenticatedDevice {
  connectionId: string;
}

interface PendingDelivery {
  writer: Bun.ServerWebSocket<SocketData>;
  pairingId: string;
  timeout: ReturnType<typeof setTimeout>;
}

interface DeliveryResult {
  delivered: boolean;
  error?: DeliveryError;
  expiresAt: number;
}

const host = process.env.HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const webRoot = resolve(process.env.WEB_ROOT ?? "apps/web/dist");
const databasePath = resolve(process.env.DATABASE_PATH ?? "data/kaku.sqlite");
const credentialSecret =
  process.env.CREDENTIAL_SECRET ?? randomBytes(32).toString("base64url");
const rateLimitsEnabled =
  process.env.RATE_LIMITS_ENABLED?.toLowerCase() !== "false";
const trustCloudflareProxy =
  process.env.TRUST_CLOUDFLARE_PROXY?.toLowerCase() === "true";
const pairingRateLimit = rateLimitConfig(
  process.env,
  RateLimitScope.Pairing,
  8,
  60 * 60,
);
const claimRateLimit = rateLimitConfig(
  process.env,
  RateLimitScope.Claim,
  20,
  10 * 60,
);
const websocketRateLimit = rateLimitConfig(
  process.env,
  RateLimitScope.Websocket,
  40,
  60,
);
const longestRateLimitWindowMs = Math.max(
  pairingRateLimit.windowMs,
  claimRateLimit.windowMs,
  websocketRateLimit.windowMs,
);
const maximumMessageBytes = 16 * 1024;
const deliveryTimeoutMs = 15_000;

if (!Number.isFinite(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid PORT value: ${process.env.PORT ?? "3000"}`);
}
if (!process.env.CREDENTIAL_SECRET) {
  console.warn(
    "CREDENTIAL_SECRET is unset; pending pairing codes will expire when the server restarts.",
  );
}
if (!rateLimitsEnabled) {
  console.warn(
    "Rate limits are disabled. Do not use this setting in production.",
  );
}

const store = new PairingStore(databasePath, credentialSecret);
const limiter = new RateLimiter(rateLimitsEnabled);
const connections = new Map<string, Set<Bun.ServerWebSocket<SocketData>>>();
const pendingDeliveries = new Map<string, PendingDelivery>();
const completedDeliveries = new Map<string, DeliveryResult>();

const server = Bun.serve<SocketData>({
  hostname: host,
  port,
  async fetch(request, bunServer) {
    const url = new URL(request.url);
    const sourceAddress = clientAddress(
      request,
      bunServer.requestIP(request)?.address,
      trustCloudflareProxy,
    );

    if (url.pathname === "/healthz") {
      return Response.json(
        { status: "ok", service: "kaku" },
        {
          headers: { "cache-control": "no-store" },
        },
      );
    }

    if (url.pathname.startsWith("/api/") && request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: apiHeaders() });
    }

    if (url.pathname === "/api/pairings" && request.method === "POST") {
      if (
        !limiter.allow(
          `pair:${sourceAddress}`,
          pairingRateLimit.maximum,
          pairingRateLimit.windowMs,
        )
      )
        return apiError(429, ProtocolErrorCode.RateLimited);
      return apiJson(store.createPairing(), 201);
    }

    if (url.pathname === "/api/pairings/claim" && request.method === "POST") {
      if (
        !limiter.allow(
          `claim:${sourceAddress}`,
          claimRateLimit.maximum,
          claimRateLimit.windowMs,
        )
      )
        return apiError(429, ProtocolErrorCode.RateLimited);
      const body = await parseSmallJson(request);
      if (!body || typeof body.code !== "string")
        return apiError(400, "invalid_request");
      const session = store.claimPairing(body.code);
      if (!session) return apiError(400, "invalid_or_expired_code");
      const writer = store.authenticate(session.token);
      if (writer)
        sendToRole(writer.pairingId, DeviceRole.Extension, {
          type: MessageType.PairingCompleted,
        });
      return apiJson(session, 200);
    }

    if (url.pathname === "/api/session" && request.method === "GET") {
      const device = authenticateHttp(request);
      if (!device) return apiError(401, ProtocolErrorCode.Unauthorized);
      return apiJson(
        {
          role: device.role,
          extensionOnline: roleOnline(device.pairingId, DeviceRole.Extension),
        },
        200,
      );
    }

    if (
      url.pathname === "/api/pairings/current" &&
      request.method === "DELETE"
    ) {
      const device = authenticateHttp(request);
      if (!device) return apiError(401, ProtocolErrorCode.Unauthorized);
      store.revokePairing(device.pairingId);
      for (const socket of connections.get(device.pairingId) ?? []) {
        socket.close(1008, "Pairing revoked");
      }
      connections.delete(device.pairingId);
      return new Response(null, { status: 204, headers: apiHeaders() });
    }

    if (url.pathname === "/ws") {
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
        return new Response("WebSocket upgrade required", { status: 426 });
      }
      if (
        !limiter.allow(
          `ws:${sourceAddress}`,
          websocketRateLimit.maximum,
          websocketRateLimit.windowMs,
        )
      )
        return apiError(429, ProtocolErrorCode.RateLimited);
      const token = url.searchParams.get("token");
      const device = token ? store.authenticate(token) : undefined;
      if (!device) return apiError(401, ProtocolErrorCode.Unauthorized);
      const upgraded = bunServer.upgrade(request, {
        data: { ...device, connectionId: crypto.randomUUID() },
      });
      return upgraded
        ? undefined
        : new Response("WebSocket upgrade failed", { status: 400 });
    }

    if (url.pathname === "/app") {
      return Response.redirect(new URL("/app/", url).href, 308);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }

    return serveWebAsset(url.pathname, request.method === "HEAD");
  },
  websocket: {
    idleTimeout: 70,
    maxPayloadLength: maximumMessageBytes,
    open(socket) {
      const pairingSockets =
        connections.get(socket.data.pairingId) ?? new Set();
      pairingSockets.add(socket);
      connections.set(socket.data.pairingId, pairingSockets);
      store.touch(socket.data.deviceId);
      send(socket, {
        type: MessageType.ConnectionReady,
        connectionId: socket.data.connectionId,
        role: socket.data.role,
        paired: socket.data.paired,
      });
      if (socket.data.role === DeviceRole.Writer) {
        send(socket, {
          type: MessageType.PresenceChanged,
          extensionOnline: roleOnline(
            socket.data.pairingId,
            DeviceRole.Extension,
          ),
        });
      } else {
        sendToRole(socket.data.pairingId, DeviceRole.Writer, {
          type: MessageType.PresenceChanged,
          extensionOnline: true,
        });
      }
    },
    message(socket, payload) {
      if (byteLength(payload) > maximumMessageBytes) {
        send(socket, {
          type: MessageType.ProtocolError,
          code: ProtocolErrorCode.MessageTooLarge,
        });
        socket.close(1009, "Message too large");
        return;
      }

      const message = parseClientMessage(
        typeof payload === "string" ? payload : payload.toString(),
      );
      if (!message) {
        send(socket, {
          type: MessageType.ProtocolError,
          code: ProtocolErrorCode.InvalidMessage,
        });
        return;
      }
      store.touch(socket.data.deviceId);
      if (message.type === MessageType.Ping) {
        send(socket, { type: MessageType.Pong });
        return;
      }

      const deliveryKey = `${socket.data.pairingId}:${message.messageId}`;
      if (message.type === MessageType.TextDeliver) {
        if (socket.data.role !== DeviceRole.Writer) {
          send(socket, {
            type: MessageType.ProtocolError,
            code: ProtocolErrorCode.WrongDeviceRole,
          });
          return;
        }
        const previous = completedDeliveries.get(deliveryKey);
        if (previous) {
          send(socket, {
            type: MessageType.DeliveryResult,
            messageId: message.messageId,
            ...previousResult(previous),
          });
          return;
        }
        if (pendingDeliveries.has(deliveryKey)) {
          send(socket, {
            type: MessageType.ProtocolError,
            code: ProtocolErrorCode.DuplicateMessage,
          });
          return;
        }
        const receiver = firstSocket(
          socket.data.pairingId,
          DeviceRole.Extension,
        );
        if (!receiver) {
          send(socket, {
            type: MessageType.DeliveryResult,
            messageId: message.messageId,
            delivered: false,
            error: DeliveryError.PeerOffline,
          });
          return;
        }
        const timeout = setTimeout(() => {
          pendingDeliveries.delete(deliveryKey);
          rememberResult(deliveryKey, {
            delivered: false,
            error: DeliveryError.DeliveryTimeout,
          });
          send(socket, {
            type: MessageType.DeliveryResult,
            messageId: message.messageId,
            delivered: false,
            error: DeliveryError.DeliveryTimeout,
          });
        }, deliveryTimeoutMs);
        pendingDeliveries.set(deliveryKey, {
          writer: socket,
          pairingId: socket.data.pairingId,
          timeout,
        });
        send(receiver, {
          type: MessageType.TextDelivery,
          messageId: message.messageId,
          text: message.text,
        });
        return;
      }

      if (socket.data.role !== DeviceRole.Extension) {
        send(socket, {
          type: MessageType.ProtocolError,
          code: ProtocolErrorCode.WrongDeviceRole,
        });
        return;
      }
      const pending = pendingDeliveries.get(deliveryKey);
      if (!pending || pending.pairingId !== socket.data.pairingId) return;
      clearTimeout(pending.timeout);
      pendingDeliveries.delete(deliveryKey);
      const result = {
        delivered: message.delivered,
        ...(message.error ? { error: message.error } : {}),
      };
      rememberResult(deliveryKey, result);
      send(pending.writer, {
        type: MessageType.DeliveryResult,
        messageId: message.messageId,
        ...result,
      });
    },
    close(socket) {
      const pairingSockets = connections.get(socket.data.pairingId);
      pairingSockets?.delete(socket);
      if (pairingSockets?.size === 0) connections.delete(socket.data.pairingId);
      if (
        socket.data.role === DeviceRole.Extension &&
        !roleOnline(socket.data.pairingId, DeviceRole.Extension)
      ) {
        sendToRole(socket.data.pairingId, DeviceRole.Writer, {
          type: MessageType.PresenceChanged,
          extensionOnline: false,
        });
      }
    },
  },
});

console.info(`Kaku listening on http://${server.hostname}:${server.port}`);

const cleanupTimer = setInterval(() => {
  store.cleanup();
  const now = Date.now();
  for (const [key, result] of completedDeliveries) {
    if (result.expiresAt <= now) completedDeliveries.delete(key);
  }
  limiter.cleanup(now, longestRateLimitWindowMs);
}, 60_000);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.info(`Received ${signal}; closing Kaku.`);
    clearInterval(cleanupTimer);
    for (const pending of pendingDeliveries.values())
      clearTimeout(pending.timeout);
    void server.stop(true).finally(() => {
      store.close();
      process.exit(0);
    });
  });
}

function authenticateHttp(request: Request): AuthenticatedDevice | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return store.authenticate(authorization.slice(7));
}

function send(
  socket: Bun.ServerWebSocket<SocketData>,
  message: ServerMessage,
): void {
  if (socket.readyState === WebSocket.OPEN)
    socket.send(encodeServerMessage(message));
}

function sendToRole(
  pairingId: string,
  role: DeviceRole,
  message: ServerMessage,
): void {
  for (const socket of connections.get(pairingId) ?? []) {
    if (socket.data.role === role) send(socket, message);
  }
}

function firstSocket(
  pairingId: string,
  role: DeviceRole,
): Bun.ServerWebSocket<SocketData> | undefined {
  return [...(connections.get(pairingId) ?? [])].find(
    (socket) => socket.data.role === role,
  );
}

function roleOnline(pairingId: string, role: DeviceRole): boolean {
  return firstSocket(pairingId, role) !== undefined;
}

function rememberResult(
  key: string,
  result: Omit<DeliveryResult, "expiresAt">,
): void {
  completedDeliveries.set(key, {
    ...result,
    expiresAt: Date.now() + 5 * 60_000,
  });
}

function previousResult(
  result: DeliveryResult,
): Omit<DeliveryResult, "expiresAt"> {
  return {
    delivered: result.delivered,
    ...(result.error ? { error: result.error } : {}),
  };
}

async function parseSmallJson(
  request: Request,
): Promise<Record<string, unknown> | undefined> {
  if (Number(request.headers.get("content-length") ?? 0) > 1_024)
    return undefined;
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function apiHeaders(): Record<string, string> {
  return {
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  };
}

function apiJson(value: unknown, status: number): Response {
  return Response.json(value, { status, headers: apiHeaders() });
}

function apiError(status: number, error: string): Response {
  return apiJson({ error }, status);
}

async function serveWebAsset(
  pathname: string,
  headOnly: boolean,
): Promise<Response> {
  const decodedPath = decodePathname(pathname);
  if (decodedPath === undefined)
    return new Response("Bad request", { status: 400 });

  const relativePath =
    decodedPath === "/"
      ? "index.html"
      : decodedPath.endsWith("/")
        ? `${decodedPath.slice(1)}index.html`
        : decodedPath.slice(1);
  const candidatePath = resolve(webRoot, relativePath);
  const isWithinWebRoot =
    candidatePath === webRoot || candidatePath.startsWith(`${webRoot}${sep}`);
  if (!isWithinWebRoot) return new Response("Not found", { status: 404 });

  const candidate = Bun.file(candidatePath);
  if (await candidate.exists())
    return fileResponse(candidate, pathname, headOnly);

  if (pathname.startsWith("/assets/") || pathname.includes(".")) {
    return new Response("Not found", { status: 404 });
  }

  const fallbackPath = pathname.startsWith("/app/")
    ? "app/index.html"
    : "index.html";
  const fallback = Bun.file(resolve(webRoot, fallbackPath));
  if (await fallback.exists())
    return fileResponse(fallback, `/${fallbackPath}`, headOnly);

  return new Response("Web application has not been built", { status: 503 });
}

function fileResponse(
  file: Blob,
  pathname: string,
  headOnly: boolean,
): Response {
  const immutableAsset =
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/models/") ||
    pathname.startsWith("/ort/");
  return new Response(headOnly ? null : file, {
    headers: {
      "cache-control": immutableAsset
        ? "public, max-age=31536000, immutable"
        : "no-cache",
      "content-length": String(file.size),
      ...(file.type ? { "content-type": file.type } : {}),
    },
  });
}

function decodePathname(pathname: string): string | undefined {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
}

function byteLength(payload: string | Buffer): number {
  return typeof payload === "string"
    ? Buffer.byteLength(payload)
    : payload.byteLength;
}
