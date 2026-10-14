export enum DeviceRole {
  Writer = "writer",
  Extension = "extension",
}

export enum ConnectionState {
  Connecting = "connecting",
  Connected = "connected",
  Reconnecting = "reconnecting",
  Disconnected = "disconnected",
}

export enum DeliveryError {
  NoFocusedField = "no_focused_field",
  PageRestricted = "page_restricted",
  PeerOffline = "peer_offline",
  DeliveryTimeout = "delivery_timeout",
}

export enum ProtocolErrorCode {
  InvalidMessage = "invalid_message",
  MessageTooLarge = "message_too_large",
  Unauthorized = "unauthorized",
  WrongDeviceRole = "wrong_device_role",
  DuplicateMessage = "duplicate_message",
  RateLimited = "rate_limited",
}

export enum MessageType {
  Ping = "ping",
  TextDeliver = "text.deliver",
  DeliveryAck = "delivery.ack",
  ConnectionReady = "connection.ready",
  Pong = "pong",
  PairingCompleted = "pairing.completed",
  PresenceChanged = "presence.changed",
  TextDelivery = "text.delivery",
  DeliveryResult = "delivery.result",
  ProtocolError = "protocol.error",
}

export type ClientMessage =
  | { type: MessageType.Ping }
  | { type: MessageType.TextDeliver; messageId: string; text: string }
  | {
      type: MessageType.DeliveryAck;
      messageId: string;
      delivered: boolean;
      error?: DeliveryError;
    };

export type ServerMessage =
  | {
      type: MessageType.ConnectionReady;
      connectionId: string;
      role: DeviceRole;
      paired: boolean;
    }
  | { type: MessageType.Pong }
  | { type: MessageType.PairingCompleted }
  | { type: MessageType.PresenceChanged; extensionOnline: boolean }
  | { type: MessageType.TextDelivery; messageId: string; text: string }
  | {
      type: MessageType.DeliveryResult;
      messageId: string;
      delivered: boolean;
      error?: DeliveryError;
    }
  | { type: MessageType.ProtocolError; code: ProtocolErrorCode };

export interface PairingRequestResponse {
  code: string;
  token: string;
  expiresAt: string;
}

export interface PairingClaimResponse {
  token: string;
}

export function encodeClientMessage(message: ClientMessage): string {
  return JSON.stringify(message);
}

export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

export function parseClientMessage(value: unknown): ClientMessage | undefined {
  const parsed = parseObject(value);
  if (!parsed || typeof parsed.type !== "string") return undefined;
  if (parsed.type === MessageType.Ping) return { type: MessageType.Ping };
  if (
    parsed.type === MessageType.TextDeliver &&
    validId(parsed.messageId) &&
    typeof parsed.text === "string" &&
    parsed.text.trim().length > 0 &&
    [...parsed.text].length <= 4_000
  ) {
    return {
      type: MessageType.TextDeliver,
      messageId: parsed.messageId,
      text: parsed.text,
    };
  }
  if (
    parsed.type === MessageType.DeliveryAck &&
    validId(parsed.messageId) &&
    typeof parsed.delivered === "boolean" &&
    (parsed.error === undefined || isDeliveryError(parsed.error))
  ) {
    return {
      type: MessageType.DeliveryAck,
      messageId: parsed.messageId,
      delivered: parsed.delivered,
      ...(parsed.error ? { error: parsed.error } : {}),
    };
  }
  return undefined;
}

export function parseServerMessage(value: unknown): ServerMessage | undefined {
  const parsed = parseObject(value);
  if (!parsed || typeof parsed.type !== "string") return undefined;
  if (parsed.type === MessageType.Pong) return { type: MessageType.Pong };
  if (parsed.type === MessageType.PairingCompleted)
    return { type: MessageType.PairingCompleted };
  if (
    parsed.type === MessageType.ConnectionReady &&
    typeof parsed.connectionId === "string" &&
    isDeviceRole(parsed.role) &&
    typeof parsed.paired === "boolean"
  ) {
    return {
      type: MessageType.ConnectionReady,
      connectionId: parsed.connectionId,
      role: parsed.role,
      paired: parsed.paired,
    };
  }
  if (
    parsed.type === MessageType.PresenceChanged &&
    typeof parsed.extensionOnline === "boolean"
  ) {
    return {
      type: MessageType.PresenceChanged,
      extensionOnline: parsed.extensionOnline,
    };
  }
  if (
    parsed.type === MessageType.TextDelivery &&
    validId(parsed.messageId) &&
    typeof parsed.text === "string" &&
    parsed.text.length > 0
  ) {
    return {
      type: MessageType.TextDelivery,
      messageId: parsed.messageId,
      text: parsed.text,
    };
  }
  if (
    parsed.type === MessageType.DeliveryResult &&
    validId(parsed.messageId) &&
    typeof parsed.delivered === "boolean" &&
    (parsed.error === undefined || isDeliveryError(parsed.error))
  ) {
    return {
      type: MessageType.DeliveryResult,
      messageId: parsed.messageId,
      delivered: parsed.delivered,
      ...(parsed.error ? { error: parsed.error } : {}),
    };
  }
  if (
    parsed.type === MessageType.ProtocolError &&
    isProtocolError(parsed.code)
  ) {
    return { type: MessageType.ProtocolError, code: parsed.code };
  }
  return undefined;
}

export function isDeviceRole(value: unknown): value is DeviceRole {
  return value === DeviceRole.Writer || value === DeviceRole.Extension;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function isDeliveryError(value: unknown): value is DeliveryError {
  return (
    value === DeliveryError.NoFocusedField ||
    value === DeliveryError.PageRestricted ||
    value === DeliveryError.PeerOffline ||
    value === DeliveryError.DeliveryTimeout
  );
}

function isProtocolError(value: unknown): value is ProtocolErrorCode {
  return (
    value === ProtocolErrorCode.InvalidMessage ||
    value === ProtocolErrorCode.MessageTooLarge ||
    value === ProtocolErrorCode.Unauthorized ||
    value === ProtocolErrorCode.WrongDeviceRole ||
    value === ProtocolErrorCode.DuplicateMessage ||
    value === ProtocolErrorCode.RateLimited
  );
}

function parseObject(value: unknown): Record<string, unknown> | undefined {
  try {
    const candidate = typeof value === "string" ? JSON.parse(value) : value;
    return candidate !== null &&
      typeof candidate === "object" &&
      !Array.isArray(candidate)
      ? (candidate as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
