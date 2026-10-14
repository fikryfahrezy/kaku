import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import {
  MessageType,
  encodeClientMessage,
  parseServerMessage,
  ConnectionState,
  DeliveryError,
} from "@kaku/protocol";
import { WritingCanvas } from "./WritingCanvas";
import { createId } from "./id";
import {
  type InkStroke,
  type RecognitionResult,
  WritingTool,
} from "./ink-types";
import { LocalRecognizer } from "./recognizer";
import { segmentStrokes } from "./segmentation";

enum InputMode {
  Write = "write",
  Type = "type",
}

enum ConfirmationSide {
  Left = "left",
  Right = "right",
}

enum DeliveryState {
  Idle = "idle",
  Sending = "sending",
  Delivered = "delivered",
  Failed = "failed",
}

const TOKEN_KEY = "kaku.device-token";
const AUTO_SEND_KEY = "kaku.auto-send";
const AUTO_SEND_DELAY_MS = 1_500;

const stateLabel: Record<ConnectionState, string> = {
  [ConnectionState.Connecting]: "Connecting",
  [ConnectionState.Connected]: "Connected",
  [ConnectionState.Reconnecting]: "Reconnecting",
  [ConnectionState.Disconnected]: "Offline",
};

function websocketUrl(token: string): string {
  const url = new URL("/ws", window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  return url.href;
}

export function App() {
  const [token, setToken] = createSignal(localStorage.getItem(TOKEN_KEY) ?? "");
  const [pairingCode, setPairingCode] = createSignal("");
  const [pairingError, setPairingError] = createSignal("");
  const [pairingBusy, setPairingBusy] = createSignal(false);
  const [connection, setConnection] = createSignal<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [extensionOnline, setExtensionOnline] = createSignal(false);
  const [feedback, setFeedback] = createSignal("");
  const [tool, setTool] = createSignal<WritingTool>(WritingTool.Pen);
  const [strokes, setStrokes] = createSignal<InkStroke[]>([]);
  const [undoStack, setUndoStack] = createSignal<InkStroke[][]>([]);
  const [redoStack, setRedoStack] = createSignal<InkStroke[][]>([]);
  const [canvasSize, setCanvasSize] = createSignal({ width: 1, height: 1 });
  const [recognition, setRecognition] = createSignal<RecognitionResult>();
  const [recognitionError, setRecognitionError] = createSignal("");
  const [recognizing, setRecognizing] = createSignal(false);
  const [confirmedText, setConfirmedText] = createSignal("");
  const [autoSend, setAutoSend] = createSignal(
    localStorage.getItem(AUTO_SEND_KEY) === "true",
  );
  const [inputMode, setInputMode] = createSignal<InputMode>(InputMode.Write);
  const [confirmationSide, setConfirmationSide] =
    createSignal<ConfirmationSide>(ConfirmationSide.Right);
  const [deliveryState, setDeliveryState] = createSignal<DeliveryState>(
    DeliveryState.Idle,
  );
  const [pendingDelivery, setPendingDelivery] = createSignal<{
    messageId: string;
    text: string;
  }>();
  let socket: WebSocket | undefined;
  let reconnectTimer: number | undefined;
  let heartbeatTimer: number | undefined;
  let disposed = false;
  let intentionalClose = false;
  let recognizer: LocalRecognizer | undefined;
  let recognitionSequence = 0;
  let lastAutomaticText = "";
  let lastSentText = "";

  const characterGroups = createMemo(() => {
    const size = canvasSize();
    return segmentStrokes(strokes(), size.width, size.height);
  });

  createEffect(() => {
    const groups = characterGroups();
    const size = canvasSize();
    const sequence = ++recognitionSequence;
    if (groups.length === 0) {
      setRecognition(undefined);
      if (confirmedText() === lastAutomaticText) setConfirmedText("");
      lastAutomaticText = "";
      setRecognizing(false);
      return;
    }
    setRecognizing(true);
    const timer = window.setTimeout(async () => {
      if (!recognizer) {
        if (sequence === recognitionSequence) setRecognizing(false);
        return;
      }
      setRecognitionError("");
      try {
        const result = await recognizer.recognize(
          groups,
          size.width,
          size.height,
        );
        if (sequence !== recognitionSequence) return;
        setRecognition(result);
        const suggestion = result.suggestions[0]?.text ?? "";
        if (!confirmedText() || confirmedText() === lastAutomaticText)
          setConfirmedText(suggestion);
        lastAutomaticText = suggestion;
      } catch (cause) {
        if (sequence === recognitionSequence) {
          setRecognitionError(
            cause instanceof Error
              ? cause.message
              : "Local recognition failed.",
          );
        }
      } finally {
        if (sequence === recognitionSequence) setRecognizing(false);
      }
    }, 500);
    onCleanup(() => window.clearTimeout(timer));
  });

  createEffect(() => {
    const enabled = autoSend();
    const text = confirmedText().trim();
    const ready =
      connection() === ConnectionState.Connected && extensionOnline();
    const busy = deliveryState() === DeliveryState.Sending;
    const waitingForRecognition =
      inputMode() === InputMode.Write && recognizing();
    if (!text) {
      lastSentText = "";
      return;
    }
    if (
      !enabled ||
      !ready ||
      busy ||
      waitingForRecognition ||
      text === lastSentText
    )
      return;

    const timer = window.setTimeout(() => {
      if (confirmedText().trim() === text) sendText(false);
    }, AUTO_SEND_DELAY_MS);
    onCleanup(() => window.clearTimeout(timer));
  });

  onMount(() => {
    recognizer = new LocalRecognizer();
    if (token()) void restoreSession();
  });

  async function restoreSession(): Promise<void> {
    const credential = token();
    if (!credential) return;
    try {
      const response = await fetch("/api/session", {
        headers: { authorization: `Bearer ${credential}` },
      });
      if (response.status === 401) {
        clearLocalSession(
          "This pairing is no longer valid. Pair the devices again.",
        );
        return;
      }
    } catch {
      // The WebSocket reconnect loop handles temporary network failures.
    }
    connect();
  }
  onCleanup(() => {
    disposed = true;
    recognizer?.dispose();
    if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    if (heartbeatTimer !== undefined) window.clearInterval(heartbeatTimer);
    intentionalClose = true;
    socket?.close();
  });

  function connect(): void {
    const credential = token();
    if (!credential || disposed) return;
    intentionalClose = false;
    setConnection(
      connection() === ConnectionState.Disconnected
        ? ConnectionState.Connecting
        : ConnectionState.Reconnecting,
    );
    socket = new WebSocket(websocketUrl(credential));
    socket.addEventListener("open", () => {
      setConnection(ConnectionState.Connected);
      heartbeatTimer = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN)
          socket.send(encodeClientMessage({ type: MessageType.Ping }));
      }, 25_000);
    });
    socket.addEventListener("message", (event) => {
      const message = parseServerMessage(event.data);
      if (!message) return;
      if (message.type === MessageType.ConnectionReady)
        setConnection(ConnectionState.Connected);
      if (message.type === MessageType.PresenceChanged) {
        setExtensionOnline(message.extensionOnline);
        if (!message.extensionOnline)
          setFeedback(
            "Your paired browser is offline. Writing and local recognition still work.",
          );
      }
      if (message.type === MessageType.DeliveryResult)
        handleDeliveryResult(
          message.messageId,
          message.delivered,
          message.error,
        );
    });
    socket.addEventListener("close", (event) => {
      if (heartbeatTimer !== undefined) window.clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
      setExtensionOnline(false);
      if (disposed || intentionalClose) return;
      if (event.code === 1008) {
        clearLocalSession("This pairing was revoked or is no longer valid.");
        return;
      }
      setConnection(ConnectionState.Reconnecting);
      reconnectTimer = window.setTimeout(connect, 2_500);
    });
  }

  async function claimPairing(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const code = pairingCode()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (code.length !== 8) {
      setPairingError(
        "Enter the eight-character code shown by the browser extension.",
      );
      return;
    }
    setPairingBusy(true);
    setPairingError("");
    try {
      const response = await fetch("/api/pairings/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = (await response.json()) as {
        token?: unknown;
        error?: unknown;
      };
      if (!response.ok || typeof body.token !== "string") {
        throw new Error(
          response.status === 429
            ? "Too many attempts. Wait a few minutes and try again."
            : "That code is invalid, expired, or already used.",
        );
      }
      localStorage.setItem(TOKEN_KEY, body.token);
      setToken(body.token);
      setFeedback("Paired. Waiting for the receiving browser to come online…");
      connect();
    } catch (cause) {
      setPairingError(
        cause instanceof Error ? cause.message : "Pairing failed.",
      );
    } finally {
      setPairingBusy(false);
    }
  }

  async function unpair(): Promise<void> {
    const credential = token();
    if (credential) {
      await fetch("/api/pairings/current", {
        method: "DELETE",
        headers: { authorization: `Bearer ${credential}` },
      }).catch(() => undefined);
    }
    intentionalClose = true;
    socket?.close();
    clearLocalSession("Devices unpaired.");
  }

  function clearLocalSession(message: string): void {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setConnection(ConnectionState.Disconnected);
    setExtensionOnline(false);
    setPairingError(message);
  }

  function commitStrokes(previous: InkStroke[], next: InkStroke[]): void {
    setUndoStack((stack) => [...stack.slice(-49), structuredClone(previous)]);
    setRedoStack([]);
    setStrokes(next);
    setDeliveryState(DeliveryState.Idle);
  }

  function undo(): void {
    const stack = undoStack();
    const previous = stack.at(-1);
    if (!previous) return;
    setRedoStack((redo) => [...redo, structuredClone(strokes())]);
    setUndoStack(stack.slice(0, -1));
    setStrokes(structuredClone(previous));
  }

  function redo(): void {
    const stack = redoStack();
    const next = stack.at(-1);
    if (!next) return;
    setUndoStack((undo) => [...undo, structuredClone(strokes())]);
    setRedoStack(stack.slice(0, -1));
    setStrokes(structuredClone(next));
  }

  function clearCanvas(): void {
    if (strokes().length === 0) return;
    setUndoStack((undo) => [...undo, structuredClone(strokes())]);
    setRedoStack([]);
    setStrokes([]);
  }

  function chooseCharacter(groupIndex: number, character: string): void {
    const chars = [...confirmedText()];
    while (chars.length <= groupIndex) chars.push("□");
    chars[groupIndex] = character;
    setConfirmedText(chars.join(""));
  }

  function setAutoSendEnabled(enabled: boolean): void {
    setAutoSend(enabled);
    localStorage.setItem(AUTO_SEND_KEY, String(enabled));
  }

  function sendText(retry = false): void {
    const text = confirmedText().trim();
    if (!text || socket?.readyState !== WebSocket.OPEN || !extensionOnline())
      return;
    const delivery =
      retry && pendingDelivery()
        ? pendingDelivery()!
        : { messageId: createId(), text };
    setPendingDelivery(delivery);
    lastSentText = delivery.text;
    setDeliveryState(DeliveryState.Sending);
    setFeedback("Sending confirmed text…");
    socket.send(
      encodeClientMessage({ type: MessageType.TextDeliver, ...delivery }),
    );
  }

  function handleDeliveryResult(
    messageId: string,
    delivered: boolean,
    error?: DeliveryError,
  ): void {
    if (pendingDelivery()?.messageId !== messageId) return;
    if (delivered) {
      setDeliveryState(DeliveryState.Delivered);
      setFeedback("Replaced the focused field in your paired browser.");
    } else {
      setDeliveryState(DeliveryState.Failed);
      const labels: Record<DeliveryError, string> = {
        [DeliveryError.NoFocusedField]:
          "Focus an input, textarea, or editable area in your paired browser, then retry.",
        [DeliveryError.PageRestricted]:
          "This browser page blocks extension insertion. Open a regular webpage and retry.",
        [DeliveryError.PeerOffline]:
          "Your paired browser is offline. Reconnect it and retry.",
        [DeliveryError.DeliveryTimeout]:
          "Your paired browser did not acknowledge delivery. Check its connection and retry.",
      };
      setFeedback(
        error ? labels[error] : "Delivery failed. You can retry safely.",
      );
    }
  }

  const DeliveryControls = () => (
    <div class="card-footer recognition-footer">
      <Show when={feedback()}>
        <p
          class={`delivery-feedback delivery-feedback--${deliveryState()}`}
          aria-live="polite"
        >
          {feedback()}
        </p>
      </Show>
      <div class="delivery-actions">
        <label
          class="auto-send-control"
          title="Send the latest confirmed text after 1.5 seconds without changes"
        >
          <input
            type="checkbox"
            checked={autoSend()}
            onChange={(event) =>
              setAutoSendEnabled(event.currentTarget.checked)
            }
          />
          <span class="auto-send-switch" aria-hidden="true" />
          <span class="auto-send-copy">
            <strong>Auto-send</strong>
            <small>1.5s idle</small>
          </span>
        </label>
        <Show when={deliveryState() === DeliveryState.Failed}>
          <button
            class="retry-button"
            type="button"
            onClick={() => sendText(true)}
            disabled={!extensionOnline()}
          >
            Retry
          </button>
        </Show>
        <button
          class="send-button"
          type="button"
          disabled={
            !confirmedText().trim() ||
            connection() !== ConnectionState.Connected ||
            !extensionOnline() ||
            deliveryState() === DeliveryState.Sending
          }
          onClick={() => sendText(false)}
        >
          {deliveryState() === DeliveryState.Sending
            ? "Sending…"
            : deliveryState() === DeliveryState.Delivered
              ? "Send again"
              : "Send to receiver"}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </div>
  );

  return (
    <main class="app-shell">
      <header class="topbar">
        <a class="brand brand--mark-only" href="/" aria-label="Kaku home">
          <span class="brand-mark" aria-hidden="true">
            書
          </span>
        </a>
        <Show when={token()}>
          <div class="app-statuses" aria-label="Device status">
            <div class={`connection connection--${connection()}`} role="status">
              <span class="connection-dot" aria-hidden="true" />
              {stateLabel[connection()]}
            </div>
            <div
              class={`browser-presence ${extensionOnline() ? "is-online" : ""}`}
              role="status"
            >
              <span aria-hidden="true" />
              {extensionOnline() ? "Receiver ready" : "Receiver offline"}
            </div>
          </div>
        </Show>
        <a
          class="app-licenses"
          href="/licenses/"
          target="_blank"
          rel="noopener"
        >
          Open-source licenses
        </a>
      </header>

      <Show
        when={token()}
        fallback={
          <section class="pairing-screen" aria-labelledby="pairing-title">
            <h1 id="pairing-title">Pair device</h1>
            <form class="pairing-form" onSubmit={claimPairing}>
              <label class="sr-only" for="pairing-code">
                Pairing code
              </label>
              <input
                id="pairing-code"
                value={pairingCode()}
                onInput={(event) => setPairingCode(event.currentTarget.value)}
                inputmode="text"
                autocomplete="one-time-code"
                maxlength="9"
                placeholder="ABCD EFGH"
                autofocus
              />
              <button
                class="send-button"
                type="submit"
                disabled={pairingBusy()}
              >
                {pairingBusy() ? "Pairing…" : "Pair"}
                <span aria-hidden="true">↗</span>
              </button>
            </form>
            <p class="form-error" role="alert">
              {pairingError()}
            </p>
          </section>
        }
      >
        <section class="workspace workspace--writing" aria-label="Writing pad">
          <div class="mode-bar">
            <div class="mode-tabs" role="tablist" aria-label="Input method">
              <button
                classList={{ active: inputMode() === InputMode.Write }}
                onClick={() => setInputMode(InputMode.Write)}
                type="button"
                role="tab"
                aria-selected={inputMode() === InputMode.Write}
              >
                Handwrite
              </button>
              <button
                classList={{ active: inputMode() === InputMode.Type }}
                onClick={() => setInputMode(InputMode.Type)}
                type="button"
                role="tab"
                aria-selected={inputMode() === InputMode.Type}
              >
                Type
              </button>
            </div>
            <button
              class="danger-text-button unpair-button"
              type="button"
              onClick={() => void unpair()}
            >
              Unpair devices
            </button>
          </div>

          <Show
            when={inputMode() === InputMode.Write}
            fallback={
              <section class="typed-fallback">
                <div class="typed-field-heading">
                  <label for="typed-text">Japanese text</label>
                  <button
                    class="danger-text-button"
                    type="button"
                    disabled={!confirmedText()}
                    onClick={() => setConfirmedText("")}
                  >
                    Clear
                  </button>
                </div>
                <textarea
                  id="typed-text"
                  value={confirmedText()}
                  onInput={(event) =>
                    setConfirmedText(event.currentTarget.value)
                  }
                  lang="ja"
                  placeholder="ここに日本語を入力してください…"
                />
                <DeliveryControls />
              </section>
            }
          >
            <div
              class={`handwriting-layout handwriting-layout--${confirmationSide()}`}
            >
              <div class="canvas-card">
                <div class="canvas-toolbar">
                  <div class="tool-group" aria-label="Writing tools">
                    <button
                      classList={{ active: tool() === WritingTool.Pen }}
                      onClick={() => setTool(WritingTool.Pen)}
                      type="button"
                      aria-pressed={tool() === WritingTool.Pen}
                    >
                      Pen
                    </button>
                    <button
                      classList={{ active: tool() === WritingTool.Eraser }}
                      onClick={() => setTool(WritingTool.Eraser)}
                      type="button"
                      aria-pressed={tool() === WritingTool.Eraser}
                    >
                      Eraser
                    </button>
                  </div>
                  <div class="history-tools">
                    <button
                      onClick={undo}
                      disabled={undoStack().length === 0}
                      type="button"
                    >
                      Undo
                    </button>
                    <button
                      onClick={redo}
                      disabled={redoStack().length === 0}
                      type="button"
                    >
                      Redo
                    </button>
                    <button
                      onClick={clearCanvas}
                      disabled={strokes().length === 0}
                      type="button"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <WritingCanvas
                  strokes={strokes()}
                  tool={tool()}
                  onCommit={commitStrokes}
                  onSize={(width, height) => setCanvasSize({ width, height })}
                />
              </div>

              <section
                class="recognition-card"
                aria-labelledby="recognition-title"
              >
                <div class="card-heading">
                  <div class="recognition-heading">
                    <h2 id="recognition-title">Confirm recognized text</h2>
                    <span class="recognition-status">
                      {recognizing()
                        ? "Recognizing locally…"
                        : recognition()
                          ? `${recognition()!.groups.length} groups`
                          : "Waiting for ink"}
                    </span>
                  </div>
                  <div
                    class="panel-side-toggle"
                    role="group"
                    aria-label="Confirmation panel position"
                  >
                    <button
                      classList={{
                        active: confirmationSide() === ConfirmationSide.Left,
                      }}
                      type="button"
                      aria-pressed={
                        confirmationSide() === ConfirmationSide.Left
                      }
                      onClick={() => setConfirmationSide(ConfirmationSide.Left)}
                    >
                      Left
                    </button>
                    <button
                      classList={{
                        active: confirmationSide() === ConfirmationSide.Right,
                      }}
                      type="button"
                      aria-pressed={
                        confirmationSide() === ConfirmationSide.Right
                      }
                      onClick={() =>
                        setConfirmationSide(ConfirmationSide.Right)
                      }
                    >
                      Right
                    </button>
                  </div>
                </div>

                <Show when={recognition()?.groups.length}>
                  <div class="candidate-groups">
                    <For each={recognition()?.groups}>
                      {(group, groupIndex) => (
                        <div
                          class="candidate-group"
                          aria-label={`Alternatives for character ${groupIndex() + 1}`}
                        >
                          <For each={group.candidates}>
                            {(candidate, candidateIndex) => (
                              <button
                                classList={{
                                  selected:
                                    [...confirmedText()][groupIndex()] ===
                                      candidate.character ||
                                    (!confirmedText() &&
                                      candidateIndex() === 0),
                                }}
                                type="button"
                                onClick={() =>
                                  chooseCharacter(
                                    groupIndex(),
                                    candidate.character,
                                  )
                                }
                                title={`${Math.round(candidate.confidence * 100)}% confidence`}
                              >
                                <span>{candidate.character}</span>
                                <small>
                                  {Math.round(candidate.confidence * 100)}%
                                </small>
                              </button>
                            )}
                          </For>
                        </div>
                      )}
                    </For>
                  </div>
                  <div class="sentence-suggestions">
                    <span>Sentence suggestions</span>
                    <For each={recognition()?.suggestions}>
                      {(suggestion) => (
                        <button
                          type="button"
                          onClick={() => setConfirmedText(suggestion.text)}
                        >
                          {suggestion.text}
                          <small>
                            {Math.round(suggestion.confidence * 100)}%
                          </small>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>

                <label class="confirmation-field">
                  <span>Confirmed text — edit before sending</span>
                  <textarea
                    value={confirmedText()}
                    onInput={(event) =>
                      setConfirmedText(event.currentTarget.value)
                    }
                    lang="ja"
                    placeholder="Recognized text appears here. You can always type a correction."
                  />
                </label>
                <Show when={recognitionError()}>
                  <p class="recognition-error" role="alert">
                    {recognitionError()} Use “Type instead” while local
                    recognition is unavailable.
                  </p>
                </Show>
                <DeliveryControls />
              </section>
            </div>
          </Show>
        </section>
      </Show>
    </main>
  );
}
