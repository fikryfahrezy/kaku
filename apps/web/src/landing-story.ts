// Scroll timeline for the landing page walkthrough. Positions are in story
// units, where one unit is one viewport height of scrolling.

export const STORY_UNITS = 14;
// Size of the replica world: a tablet running the writing pad, the relay, and
// a desktop browser running the receiver extension.
export const WORLD = { width: 2120, height: 880 };

export type StoryTarget =
  | "overview"
  | "extension"
  | "popup"
  | "popup-pair"
  | "popup-code"
  | "pairing"
  | "pairing-input"
  | "pairing-submit"
  | "statuses"
  | "canvas"
  | "ink"
  | "tools"
  | "recognition"
  | "candidates"
  | "alternative"
  | "suggestions"
  | "confirm"
  | "send"
  | "link"
  | "field"
  | "feedback"
  | "autosend"
  | "side"
  | "tabs"
  | "type-tab"
  | "write-tab"
  | "model"
  | "relay";

export interface StoryChapter {
  id: string;
  start: number;
  end: number;
  kanji: string;
  eyebrow: string;
  title: string;
  body: string;
}

export const storyChapters: StoryChapter[] = [
  {
    id: "pair",
    start: 1.1,
    end: 3,
    kanji: "対",
    eyebrow: "01 / PAIR",
    title: "Pair once, with a short code.",
    body: "Ask the browser receiver for a one-time code and type it on the device you write with. The code expires after ten minutes; the pairing stays.",
  },
  {
    id: "write",
    start: 3,
    end: 4.9,
    kanji: "書",
    eyebrow: "02 / WRITE",
    title: "Write it the way you learned it.",
    body: "Kanji, hiragana, or katakana, with a stylus, a finger, or a mouse. Pen, eraser, undo, and redo sit right above the grid.",
  },
  {
    id: "confirm",
    start: 4.9,
    end: 6.8,
    kanji: "選",
    eyebrow: "03 / CONFIRM",
    title: "Close is not the same as right.",
    body: "Every character comes with alternatives and a confidence score. Tap 大 and the sentence follows. The confirmed text always stays editable.",
  },
  {
    id: "send",
    start: 6.8,
    end: 8.8,
    kanji: "送",
    eyebrow: "04 / SEND",
    title: "Send it to wherever your cursor is.",
    body: "The text lands in the focused field of your paired browser: a chat, a search box, a form. It replaces the field, so sending again is always safe.",
  },
  {
    id: "flow",
    start: 8.8,
    end: 10.6,
    kanji: "流",
    eyebrow: "05 / YOUR WAY",
    title: "Set it up for your hand.",
    body: "Auto-send delivers after 1.5 seconds of stillness. Move the confirm panel to either side, or switch to typing when a keyboard is faster.",
  },
  {
    id: "private",
    start: 10.6,
    end: 12.1,
    kanji: "私",
    eyebrow: "06 / PRIVATE",
    title: "Your strokes never leave the tablet.",
    body: "Recognition runs locally in the writing pad. Only the confirmed text crosses the relay, and you can self-host that relay on hardware you control.",
  },
];

interface CameraKey {
  at: number;
  target: StoryTarget;
  // Fraction of the focus area the target should fill.
  fill: number;
  rotateX: number;
  rotateY: number;
  skew: number;
  // Multiplies the overview scale; only used for the "overview" target.
  zoom?: number;
}

const cameraKeys: CameraKey[] = [
  {
    at: 0,
    target: "overview",
    fill: 1,
    rotateX: 20,
    rotateY: -30,
    skew: 3,
    zoom: 1.2,
  },
  { at: 0.9, target: "overview", fill: 1, rotateX: 0, rotateY: 0, skew: 0 },
  { at: 1.55, target: "popup", fill: 0.78, rotateX: 4, rotateY: 10, skew: 0 },
  {
    at: 2.1,
    target: "pairing",
    fill: 0.8,
    rotateX: 0,
    rotateY: -8,
    skew: -1,
  },
  {
    at: 2.85,
    target: "statuses",
    fill: 0.7,
    rotateX: -4,
    rotateY: -4,
    skew: 0,
  },
  { at: 3.35, target: "canvas", fill: 0.96, rotateX: 6, rotateY: -6, skew: 0 },
  { at: 3.9, target: "ink", fill: 0.82, rotateX: 0, rotateY: -10, skew: -1.5 },
  { at: 4.55, target: "tools", fill: 0.82, rotateX: -4, rotateY: 4, skew: 0 },
  {
    at: 5.2,
    target: "recognition",
    fill: 0.94,
    rotateX: 0,
    rotateY: 8,
    skew: 0,
  },
  {
    at: 5.65,
    target: "candidates",
    fill: 0.86,
    rotateX: 4,
    rotateY: 10,
    skew: 1.5,
  },
  { at: 6.35, target: "confirm", fill: 0.8, rotateX: -4, rotateY: 6, skew: 0 },
  { at: 7.1, target: "send", fill: 0.48, rotateX: 0, rotateY: 8, skew: 1 },
  { at: 7.65, target: "link", fill: 0.96, rotateX: 8, rotateY: -6, skew: 0 },
  { at: 8.2, target: "field", fill: 0.82, rotateX: 0, rotateY: -12, skew: -1 },
  { at: 8.6, target: "field", fill: 0.9, rotateX: -4, rotateY: -8, skew: 0 },
  { at: 9.1, target: "autosend", fill: 0.5, rotateX: 0, rotateY: 8, skew: 1 },
  { at: 9.65, target: "side", fill: 0.5, rotateX: 4, rotateY: 6, skew: 0 },
  { at: 10.2, target: "tabs", fill: 0.55, rotateX: -4, rotateY: -8, skew: -1 },
  {
    at: 10.95,
    target: "overview",
    fill: 1,
    rotateX: 14,
    rotateY: 16,
    skew: 0,
    zoom: 1,
  },
  { at: 11.5, target: "relay", fill: 0.5, rotateX: 0, rotateY: 0, skew: 0 },
  { at: 12.4, target: "overview", fill: 1, rotateX: 0, rotateY: 0, skew: 0 },
  {
    at: 13.2,
    target: "overview",
    fill: 1,
    rotateX: 54,
    rotateY: 0,
    skew: 0,
    zoom: 0.66,
  },
];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Camera {
  x: number;
  y: number;
  scale: number;
  rotateX: number;
  rotateY: number;
  skew: number;
}

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

// Progress of `units` through [start, end], clamped to 0..1.
export function span(units: number, start: number, end: number) {
  return clamp((units - start) / (end - start));
}

function frame(
  key: CameraKey,
  measure: (target: StoryTarget) => Rect,
  world: Rect,
  focus: Rect,
): Camera {
  const fit = Math.min(focus.width / world.width, focus.height / world.height);
  if (key.target === "overview") {
    return {
      x: world.width / 2,
      y: world.height / 2,
      scale: fit * 0.94 * (key.zoom ?? 1),
      rotateX: key.rotateX,
      rotateY: key.rotateY,
      skew: key.skew,
    };
  }
  const rect = measure(key.target);
  const scale = Math.min(
    (focus.width * key.fill) / rect.width,
    (focus.height * key.fill) / rect.height,
    fit * 6,
  );
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
    scale: Math.max(scale, fit),
    rotateX: key.rotateX,
    rotateY: key.rotateY,
    skew: key.skew,
  };
}

export function cameraAt(
  units: number,
  measure: (target: StoryTarget) => Rect,
  world: Rect,
  focus: Rect,
  still = false,
): Camera {
  const next = cameraKeys.findIndex((key) => key.at > units);
  const from =
    cameraKeys[next === -1 ? cameraKeys.length - 1 : Math.max(next - 1, 0)]!;
  const to = cameraKeys[next === -1 ? cameraKeys.length - 1 : next]!;
  const a = frame(from, measure, world, focus);
  if (from === to) return still ? flat(a) : a;
  const b = frame(to, measure, world, focus);
  // Snap between keys when motion is reduced instead of travelling.
  const t = still
    ? Math.round(span(units, from.at, to.at))
    : ease(span(units, from.at, to.at));
  const mix = (p: number, q: number) => p + (q - p) * t;
  // Interpolate scale geometrically so zooms feel even.
  const camera = {
    x: mix(a.x, b.x),
    y: mix(a.y, b.y),
    scale: a.scale * (b.scale / a.scale) ** t,
    rotateX: mix(a.rotateX, b.rotateX),
    rotateY: mix(a.rotateY, b.rotateY),
    skew: mix(a.skew, b.skew),
  };
  return still ? flat(camera) : camera;
}

function flat(camera: Camera): Camera {
  return { ...camera, rotateX: 0, rotateY: 0, skew: 0 };
}

export const pairingCode = "KQ7M 2XPA";
export const guessedText = "犬好き";
export const confirmedText = "大好き";

// Each entry holds its value until the story reaches `until`.
type Steps = [until: number, target: StoryTarget | null][];

const highlights: Steps = [
  [1.3, null],
  [1.62, "popup-pair"],
  [2.05, "popup-code"],
  [2.55, "pairing-input"],
  [2.72, "pairing-submit"],
  [3.1, "statuses"],
  [4.55, null],
  [4.85, "tools"],
  [5.45, null],
  [5.95, "alternative"],
  [6.2, "suggestions"],
  [6.75, "confirm"],
  [7.4, "send"],
  [8, null],
  [8.75, "field"],
  [9.4, "autosend"],
  [9.85, "side"],
  [10.35, "type-tab"],
  [10.9, null],
  [11.35, "model"],
  [12, "relay"],
];

const cursors: Steps = [
  [1.12, null],
  [1.3, "extension"],
  [1.62, "popup-pair"],
  [2, null],
  [2.5, "pairing-input"],
  [2.75, "pairing-submit"],
  [5.5, null],
  [5.95, "alternative"],
  [6.95, null],
  [7.4, "send"],
  [9.05, null],
  [9.4, "autosend"],
  [9.85, "side"],
  [10.3, "type-tab"],
  [10.6, "write-tab"],
];

function stepAt(steps: Steps, units: number) {
  return steps.find(([until]) => units < until)?.[1] ?? null;
}

export type Delivery = "idle" | "sending" | "delivered";

export interface ReplicaState {
  popupOpen: boolean;
  codeShown: boolean;
  paired: boolean;
  typedCode: string;
  // Overall progress through the handwritten strokes, 0..1.
  ink: number;
  recognizing: boolean;
  recognized: boolean;
  confirmed: string;
  delivery: Delivery;
  // Progress of the text travelling over the relay, 0..1.
  packet: number;
  field: string;
  flash: boolean;
  autoSend: boolean;
  side: "left" | "right";
  mode: "write" | "type";
  local: boolean;
  highlight: StoryTarget | null;
  cursor: StoryTarget | null;
  pressing: boolean;
}

export function replicaAt(units: number): ReplicaState {
  const u = units;
  const plainCode = pairingCode.replace(" ", "");
  const typed = plainCode.slice(
    0,
    Math.round(span(u, 2.05, 2.45) * plainCode.length),
  );
  const recognized = u >= 4.8;
  return {
    popupOpen: u >= 1.25 && u < 2.8,
    codeShown: u >= 1.6,
    paired: u >= 2.72,
    typedCode:
      typed.length > 4 ? `${typed.slice(0, 4)} ${typed.slice(4)}` : typed,
    ink: Math.round(span(u, 3.3, 4.5) * 400) / 400,
    recognizing: u >= 4.55 && !recognized,
    recognized,
    confirmed: !recognized ? "" : u >= 5.85 ? confirmedText : guessedText,
    delivery: u >= 7.95 ? "delivered" : u >= 7.3 ? "sending" : "idle",
    packet: Math.round(span(u, 7.35, 7.95) * 200) / 200,
    field: u >= 7.95 ? confirmedText : "",
    flash: u >= 7.95 && u < 8.5,
    autoSend: u >= 9.3,
    side: u >= 9.78 ? "left" : "right",
    mode: u >= 10.25 && u < 10.55 ? "type" : "write",
    local: u >= 10.85,
    highlight: stepAt(highlights, u),
    cursor: stepAt(cursors, u),
    pressing: [1.25, 1.58, 2.68, 5.85, 7.3, 9.3, 9.78, 10.25, 10.55].some(
      (at) => Math.abs(u - at) < 0.05,
    ),
  };
}
