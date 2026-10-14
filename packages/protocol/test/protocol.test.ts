import { describe, expect, test } from "bun:test";
import {
  DeliveryError,
  MessageType,
  ProtocolErrorCode,
  encodeClientMessage,
  encodeServerMessage,
  parseClientMessage,
  parseServerMessage,
} from "../src";

describe("protocol parsing", () => {
  test("enum messages preserve wire values and round trip", () => {
    const ack = {
      type: MessageType.DeliveryAck,
      messageId: "wire-test",
      delivered: false,
      error: DeliveryError.NoFocusedField,
    } as const;
    const encoded = encodeClientMessage(ack);
    expect(JSON.parse(encoded)).toEqual({
      type: "delivery.ack",
      messageId: "wire-test",
      delivered: false,
      error: "no_focused_field",
    });
    expect(parseClientMessage(encoded)).toEqual(ack);

    const error = {
      type: MessageType.ProtocolError,
      code: ProtocolErrorCode.RateLimited,
    } as const;
    const encodedError = encodeServerMessage(error);
    expect(JSON.parse(encodedError)).toEqual({
      type: "protocol.error",
      code: "rate_limited",
    });
    expect(parseServerMessage(encodedError)).toEqual(error);
    expect(
      parseServerMessage({ type: "protocol.error", code: "unknown" }),
    ).toBeUndefined();
    expect(parseClientMessage({ ...ack, error: "unknown" })).toBeUndefined();
  });

  test("accepts delivery and acknowledgement messages", () => {
    expect(
      parseClientMessage(
        JSON.stringify({
          type: "text.deliver",
          messageId: "message-1",
          text: "日本語",
        }),
      ),
    ).toEqual({ type: "text.deliver", messageId: "message-1", text: "日本語" });
    expect(
      parseClientMessage({
        type: "delivery.ack",
        messageId: "message-1",
        delivered: false,
        error: "no_focused_field",
      }),
    ).toEqual({
      type: "delivery.ack",
      messageId: "message-1",
      delivered: false,
      error: "no_focused_field",
    });
  });

  test("rejects empty text, unbounded ids, and malformed JSON", () => {
    expect(parseClientMessage('{"type":')).toBeUndefined();
    expect(
      parseClientMessage({
        type: "text.deliver",
        messageId: "message-1",
        text: "   ",
      }),
    ).toBeUndefined();
    expect(parseClientMessage({ type: "ping", extra: "is ignored" })).toEqual({
      type: "ping",
    });
    expect(
      parseClientMessage({
        type: "delivery.ack",
        messageId: "x".repeat(129),
        delivered: true,
      }),
    ).toBeUndefined();
  });

  test("accepts presence, delivery, and result server messages", () => {
    expect(
      parseServerMessage({
        type: "connection.ready",
        connectionId: "connection-1",
        role: "writer",
        paired: true,
      }),
    ).toEqual({
      type: "connection.ready",
      connectionId: "connection-1",
      role: "writer",
      paired: true,
    });
    expect(
      parseServerMessage({
        type: "connection.ready",
        connectionId: "connection-1",
        role: "ipad",
        paired: true,
      }),
    ).toBeUndefined();
    expect(
      parseServerMessage('{"type":"presence.changed","extensionOnline":true}'),
    ).toEqual({ type: "presence.changed", extensionOnline: true });
    expect(
      parseServerMessage({
        type: "text.delivery",
        messageId: "m1",
        text: "語",
      }),
    ).toEqual({ type: "text.delivery", messageId: "m1", text: "語" });
    expect(
      parseServerMessage({
        type: "delivery.result",
        messageId: "m1",
        delivered: true,
      }),
    ).toEqual({ type: "delivery.result", messageId: "m1", delivered: true });
  });
});
