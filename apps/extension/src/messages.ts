export enum ExtensionConnectionState {
  NotPaired = "not-paired",
  Waiting = "waiting",
  Connecting = "connecting",
  Online = "online",
  Reconnecting = "reconnecting",
  Error = "error",
}

export enum ExtensionMessageType {
  StateGet = "state.get",
  PairingRequest = "pairing.request",
  ServerSave = "server.save",
  PairingUnpair = "pairing.unpair",
  StateChanged = "state.changed",
  InsertText = "insert-text",
  EditableFocused = "editable.focused",
}

export interface ExtensionState {
  serverUrl: string;
  token?: string;
  pairingCode?: string;
  pairingExpiresAt?: string;
  connectionState: ExtensionConnectionState;
  lastError?: string;
}
