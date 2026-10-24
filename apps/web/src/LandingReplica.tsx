import { For, Index, Show } from "solid-js";
import { clamp, confirmedText, pairingCode } from "./landing-story";
import type { ReplicaState } from "./landing-story";

// Handwritten 大好き, one path per stroke in a 100×100 cell.
const glyphs = [
  [
    "M14 38 Q50 33 87 35",
    "M51 9 Q53 42 45 60 Q35 80 12 94",
    "M52 47 Q64 73 91 91",
  ],
  [
    "M27 9 Q21 30 13 46 Q30 56 41 72",
    "M41 26 Q35 62 9 90",
    "M4 49 Q27 46 49 43",
    "M57 17 L93 15 Q82 30 71 40",
    "M72 40 Q75 70 72 92 Q67 95 61 88",
    "M51 58 Q76 55 99 53",
  ],
  [
    "M27 27 Q50 24 73 21",
    "M23 45 Q50 41 79 37",
    "M42 8 Q58 42 73 60 Q47 55 33 66",
    "M33 79 Q50 93 78 90",
  ],
];
const strokeCount = glyphs.flat().length;

const candidates = [
  [
    ["犬", 52],
    ["大", 41],
    ["太", 4],
    ["丈", 2],
    ["六", 1],
  ],
  [
    ["好", 88],
    ["奸", 4],
    ["妤", 3],
    ["奴", 3],
    ["如", 2],
  ],
  [
    ["き", 91],
    ["さ", 4],
    ["ぎ", 2],
    ["キ", 2],
    ["ち", 1],
  ],
] as const;

const suggestions = [
  ["犬好き", 52],
  ["大好き", 41],
  ["太好き", 4],
] as const;

interface LandingReplicaProps {
  state: ReplicaState;
  ref?: (element: HTMLDivElement) => void;
}

export function LandingReplica(props: LandingReplicaProps) {
  const s = () => props.state;
  const strokeAt = (glyph: number, stroke: number) => {
    const index = glyphs.slice(0, glyph).flat().length + stroke;
    return clamp(s().ink * strokeCount - index);
  };

  const deliveryLabel = () =>
    s().delivery === "sending"
      ? "Sending…"
      : s().delivery === "delivered"
        ? "Send again"
        : "Send to receiver";

  const Delivery = () => (
    <div class="rp-footer">
      <p
        class="rp-feedback"
        classList={{ delivered: s().delivery === "delivered" }}
        data-target="feedback"
      >
        {s().delivery === "delivered"
          ? "Replaced the focused field in your paired browser."
          : s().delivery === "sending"
            ? "Sending confirmed text…"
            : ""}
      </p>
      <span
        class="rp-auto"
        classList={{ on: s().autoSend }}
        data-target="autosend"
      >
        <i />
        <span>
          <strong>Auto-send</strong>
          <small>1.5s idle</small>
        </span>
      </span>
      <span
        class="rp-send"
        classList={{ disabled: !s().confirmed }}
        data-target="send"
      >
        {deliveryLabel()}
        <span>↗</span>
      </span>
    </div>
  );

  return (
    <div ref={props.ref} class="replica" aria-hidden="true" inert>
      <div class="rp-tablet">
        <div class="rp-screen">
          <header class="rp-topbar">
            <span class="rp-mark" lang="ja">
              書
            </span>
            <Show when={s().paired}>
              <div class="rp-statuses" data-target="statuses">
                <span class="rp-status online">
                  <i />
                  Connected
                </span>
                <span class="rp-status online">
                  <i />
                  Receiver ready
                </span>
              </div>
            </Show>
            <span class="rp-licenses">Open-source licenses</span>
          </header>

          <Show
            when={s().paired}
            fallback={
              <section class="rp-pairing" data-target="pairing">
                <h3>Pair device</h3>
                <div class="rp-pairing-form">
                  <span
                    class="rp-code-input"
                    classList={{ empty: !s().typedCode }}
                    data-target="pairing-input"
                  >
                    {s().typedCode || "ABCD EFGH"}
                    <i class="rp-caret" />
                  </span>
                  <span class="rp-send" data-target="pairing-submit">
                    Pair <span>↗</span>
                  </span>
                </div>
              </section>
            }
          >
            <div class="rp-modebar">
              <div class="rp-tabs" data-target="tabs">
                <span
                  classList={{ active: s().mode === "write" }}
                  data-target="write-tab"
                >
                  Handwrite
                </span>
                <span
                  classList={{ active: s().mode === "type" }}
                  data-target="type-tab"
                >
                  Type
                </span>
              </div>
              <span class="rp-unpair">Unpair devices</span>
            </div>

            <Show
              when={s().mode === "write"}
              fallback={
                <section class="rp-typed">
                  <div class="rp-typed-heading">
                    <span>Japanese text</span>
                    <span class="rp-unpair">Clear</span>
                  </div>
                  <div class="rp-textarea rp-textarea--large" lang="ja">
                    {s().confirmed}
                  </div>
                  <Delivery />
                </section>
              }
            >
              <div class="rp-layout" classList={{ left: s().side === "left" }}>
                <div class="rp-canvas-card" data-target="canvas">
                  <div class="rp-toolbar" data-target="tools">
                    <div>
                      <span class="active">Pen</span>
                      <span>Eraser</span>
                    </div>
                    <div class="rp-history">
                      <span classList={{ muted: s().ink === 0 }}>Undo</span>
                      <span class="muted">Redo</span>
                      <span classList={{ muted: s().ink === 0 }}>Clear</span>
                    </div>
                  </div>
                  <div class="rp-canvas">
                    <div class="rp-ink" data-target="ink">
                      <svg viewBox="0 0 336 112" width="336" height="112">
                        <Index each={glyphs}>
                          {(strokes, glyph) => (
                            <g transform={`translate(${glyph * 112 + 6} 6)`}>
                              <Index each={strokes()}>
                                {(path, stroke) => (
                                  <path
                                    d={path()}
                                    pathLength="1"
                                    stroke-dasharray="1 1"
                                    stroke-dashoffset={
                                      1 - strokeAt(glyph, stroke)
                                    }
                                    // Round caps would leave a dot before the stroke starts.
                                    opacity={
                                      strokeAt(glyph, stroke) > 0 ? 1 : 0
                                    }
                                  />
                                )}
                              </Index>
                            </g>
                          )}
                        </Index>
                      </svg>
                    </div>
                    <span
                      class="rp-local"
                      classList={{ shown: s().local }}
                      data-target="model"
                    >
                      <i />
                      Recognized on this device · strokes stay here
                    </span>
                  </div>
                </div>

                <section class="rp-recognition" data-target="recognition">
                  <div class="rp-card-heading">
                    <div>
                      <h4>Confirm recognized text</h4>
                      <span>
                        {s().recognizing
                          ? "Recognizing locally…"
                          : s().recognized
                            ? "3 groups"
                            : "Waiting for ink"}
                      </span>
                    </div>
                    <div class="rp-side" data-target="side">
                      <span classList={{ active: s().side === "left" }}>
                        Left
                      </span>
                      <span classList={{ active: s().side === "right" }}>
                        Right
                      </span>
                    </div>
                  </div>

                  <div class="rp-results" classList={{ shown: s().recognized }}>
                    <div class="rp-groups" data-target="candidates">
                      <For each={candidates}>
                        {(group, groupIndex) => (
                          <div class="rp-group">
                            <For each={group}>
                              {([character, confidence]) => (
                                <span
                                  classList={{
                                    selected:
                                      [...s().confirmed][groupIndex()] ===
                                      character,
                                  }}
                                  data-target={
                                    groupIndex() === 0 && character === "大"
                                      ? "alternative"
                                      : undefined
                                  }
                                >
                                  <b lang="ja">{character}</b>
                                  <small>{confidence}%</small>
                                </span>
                              )}
                            </For>
                          </div>
                        )}
                      </For>
                    </div>
                    <div class="rp-suggestions" data-target="suggestions">
                      <span>Sentence suggestions</span>
                      <For each={suggestions}>
                        {([text, confidence]) => (
                          <span
                            class="rp-suggestion"
                            classList={{ selected: s().confirmed === text }}
                            lang="ja"
                          >
                            {text}
                            <small>{confidence}%</small>
                          </span>
                        )}
                      </For>
                    </div>
                  </div>

                  <div class="rp-confirm" data-target="confirm">
                    <span>Confirmed text — edit before sending</span>
                    <div class="rp-textarea" lang="ja">
                      {s().confirmed || (
                        <em>
                          Recognized text appears here. You can always type a
                          correction.
                        </em>
                      )}
                    </div>
                  </div>
                  <Delivery />
                </section>
              </div>
            </Show>
          </Show>
        </div>
      </div>

      <div
        class="rp-relay"
        classList={{ shown: s().local }}
        data-target="relay"
      >
        <span class="rp-relay-node" lang="ja">
          中継
        </span>
        <small>Your relay · text only</small>
      </div>
      <div class="rp-wire" />
      <span
        class="rp-packet"
        lang="ja"
        style={{
          "--packet": s().packet,
          opacity: s().packet > 0 && s().packet < 1 ? 1 : 0,
        }}
      >
        {confirmedText}
      </span>
      <div class="rp-link-frame" data-target="link" />

      <div class="rp-browser">
        <div class="rp-chrome">
          <span class="rp-lights">
            <i />
            <i />
            <i />
          </span>
          <span class="rp-url">chat.example.com/yuki</span>
          <span
            class="rp-extension"
            classList={{ active: s().popupOpen, paired: s().paired }}
            data-target="extension"
            lang="ja"
          >
            書
          </span>
        </div>
        <div class="rp-page">
          <header class="rp-chat-head">
            <span class="rp-avatar" lang="ja">
              ゆ
            </span>
            <div>
              <strong>Yuki</strong>
              <small>Active now</small>
            </div>
          </header>
          <div class="rp-thread">
            <p class="rp-bubble" lang="ja">
              おかえり！
              <small>9:41</small>
            </p>
            <p class="rp-bubble" lang="ja">
              日本の夏、どうだった？
              <small>9:42</small>
            </p>
          </div>
          <div
            class="rp-field"
            classList={{ flash: s().flash, filled: Boolean(s().field) }}
            data-target="field"
          >
            <span lang="ja">{s().field || "Message Yuki"}</span>
            <i class="rp-caret" />
            <span class="rp-field-send">↑</span>
          </div>
        </div>

        <div
          class="rp-popup"
          classList={{ open: s().popupOpen }}
          data-target="popup"
        >
          <header>
            <span class="rp-mark" lang="ja">
              書
            </span>
            <div>
              <strong>Kaku</strong>
              <small>Browser text receiver</small>
            </div>
          </header>
          <p class="rp-popup-status" classList={{ waiting: s().codeShown }}>
            <i />
            {s().paired
              ? "Connected"
              : s().codeShown
                ? "Waiting for writing device"
                : "Not paired"}
          </p>
          <div class="rp-popup-code" classList={{ shown: s().codeShown }}>
            <p>
              Enter this one-time code on your writing device. It expires after
              10 minutes.
            </p>
            <output data-target="popup-code">{pairingCode}</output>
          </div>
          <span class="rp-popup-button" data-target="popup-pair">
            Pair a writing device
          </span>
        </div>
      </div>
    </div>
  );
}
