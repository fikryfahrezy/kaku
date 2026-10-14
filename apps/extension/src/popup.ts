import {
  ExtensionConnectionState,
  ExtensionMessageType,
  type ExtensionState,
} from "./messages";

const statusElement = document.querySelector<HTMLParagraphElement>("#status");
const pairing = document.querySelector<HTMLElement>("#pairing");
const code = document.querySelector<HTMLOutputElement>("#code");
const pair = document.querySelector<HTMLButtonElement>("#pair");
const unpair = document.querySelector<HTMLButtonElement>("#unpair");
const server = document.querySelector<HTMLInputElement>("#server");
const saveServer = document.querySelector<HTMLButtonElement>("#save-server");
const feedback = document.querySelector<HTMLParagraphElement>("#feedback");

pair?.addEventListener(
  "click",
  () =>
    void act(
      { type: ExtensionMessageType.PairingRequest },
      "Requesting a secure code…",
    ),
);
unpair?.addEventListener(
  "click",
  () =>
    void act(
      { type: ExtensionMessageType.PairingUnpair },
      "Revoking paired devices…",
    ),
);
saveServer?.addEventListener("click", () => {
  if (server)
    void act(
      { type: ExtensionMessageType.ServerSave, serverUrl: server.value },
      "Saving server…",
    );
});
chrome.runtime.onMessage.addListener((message: unknown) => {
  if (isStateChanged(message)) render(message.state);
});

void load();

async function load(): Promise<void> {
  const response = await send({ type: ExtensionMessageType.StateGet });
  if (response.ok) render(response.value as ExtensionState);
  else showError(response.error);
}

async function act(message: object, progress: string): Promise<void> {
  setBusy(true);
  if (feedback) feedback.textContent = progress;
  const response = await send(message);
  setBusy(false);
  if (response.ok) {
    render(response.value as ExtensionState);
    if (feedback) feedback.textContent = "";
  } else showError(response.error);
}

function render(state: ExtensionState): void {
  if (server) server.value = state.serverUrl;
  if (pairing) pairing.hidden = !state.pairingCode;
  if (code)
    code.textContent = state.pairingCode
      ? `${state.pairingCode.slice(0, 4)} ${state.pairingCode.slice(4)}`
      : "";
  if (pair) {
    const canRequestCode =
      state.connectionState === ExtensionConnectionState.NotPaired ||
      state.connectionState === ExtensionConnectionState.Error ||
      (state.connectionState === ExtensionConnectionState.Waiting &&
        !state.pairingCode);
    pair.hidden = !canRequestCode;
    pair.textContent =
      state.connectionState === ExtensionConnectionState.Waiting
        ? "Generate a new code"
        : "Pair a writing device";
  }
  if (unpair) unpair.hidden = !state.token;
  if (feedback) feedback.textContent = state.lastError ?? "";
  if (!statusElement) return;
  const labels: Record<ExtensionState["connectionState"], string> = {
    [ExtensionConnectionState.NotPaired]: "Not paired",
    [ExtensionConnectionState.Waiting]: "Waiting for writing device",
    [ExtensionConnectionState.Connecting]: "Connecting securely…",
    [ExtensionConnectionState.Online]: "Paired and online",
    [ExtensionConnectionState.Reconnecting]: "Paired · reconnecting…",
    [ExtensionConnectionState.Error]: "Connection error",
  };
  statusElement.className = `status status--${state.connectionState}`;
  statusElement.replaceChildren(
    document.createElement("span"),
    ` ${labels[state.connectionState]}`,
  );
}

function setBusy(value: boolean): void {
  if (pair) pair.disabled = value;
  if (unpair) unpair.disabled = value;
  if (saveServer) saveServer.disabled = value;
}

function showError(value?: string): void {
  if (feedback) feedback.textContent = value ?? "Unexpected extension error.";
}

function send(
  message: object,
): Promise<{ ok: boolean; value?: unknown; error?: string }> {
  return chrome.runtime.sendMessage(message);
}

function isStateChanged(
  value: unknown,
): value is { type: ExtensionMessageType.StateChanged; state: ExtensionState } {
  return (
    !!value &&
    typeof value === "object" &&
    "type" in value &&
    value.type === ExtensionMessageType.StateChanged &&
    "state" in value
  );
}
