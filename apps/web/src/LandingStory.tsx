import { For, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { LandingReplica } from "./LandingReplica";
import {
  STORY_UNITS,
  WORLD,
  cameraAt,
  clamp,
  replicaAt,
  span,
  storyChapters,
} from "./landing-story";
import type { Rect, StoryTarget } from "./landing-story";

const WORLD_RECT: Rect = { x: 0, y: 0, ...WORLD };
const FINALE = 12.3;

export interface LandingStoryHandle {
  jump: (at: number) => void;
}

interface LandingStoryProps {
  ref?: (handle: LandingStoryHandle) => void;
}

function lerpRect(a: Rect, b: Rect, t: number): Rect {
  const mix = (p: number, q: number) => p + (q - p) * t;
  return {
    x: mix(a.x, b.x),
    y: mix(a.y, b.y),
    width: mix(a.width, b.width),
    height: mix(a.height, b.height),
  };
}

// The part of the screen the camera frames, which shifts as the story moves
// from the hero, into the captioned walkthrough, and out to the finale.
function focusAt(u: number, width: number, height: number): Rect {
  const narrow = width < 760;
  const full = { x: 0, y: 0, width, height };
  const intro = narrow
    ? { x: 0, y: height * 0.52, width, height: height * 0.5 }
    : {
        x: width * 0.5,
        y: height * 0.12,
        width: width * 0.56,
        height: height * 0.82,
      };
  const side = narrow
    ? { x: 8, y: 76, width: width - 16, height: height * 0.56 - 76 }
    : { x: width * 0.4, y: 104, width: width * 0.53, height: height - 160 };
  const end = { x: 0, y: height * 0.42, width, height: height * 0.9 };
  let rect = lerpRect(intro, full, span(u, 0, 0.9));
  rect = lerpRect(rect, side, span(u, 1, 1.5));
  rect = lerpRect(rect, full, span(u, 11.9, 12.4));
  return lerpRect(rect, end, span(u, 12.4, 13.2));
}

export function LandingStory(props: LandingStoryProps) {
  let section!: HTMLElement;
  let stage!: HTMLDivElement;
  let rig!: HTMLDivElement;
  let ring!: HTMLDivElement;
  let cursor!: HTMLDivElement;
  let world: HTMLDivElement | undefined;

  const [ready, setReady] = createSignal(false);
  const [units, setUnits] = createSignal(0);
  const [state, setState] = createStore(replicaAt(0));

  const active = createMemo(() =>
    storyChapters.find(
      (chapter) => units() >= chapter.start && units() < chapter.end,
    ),
  );
  const heroOut = () => span(units(), 0.2, 0.75);
  const finale = () => units() >= FINALE;
  const progress = () => units() / STORY_UNITS;

  let frame = 0;
  let current = 0;
  let reduced = false;
  let visible = false;
  let observer: IntersectionObserver | undefined;

  function measure(target: StoryTarget): Rect {
    const el = world?.querySelector<HTMLElement>(`[data-target="${target}"]`);
    if (!world || !el) return WORLD_RECT;
    let x = 0;
    let y = 0;
    let node: HTMLElement | null = el;
    while (node && node !== world) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    return { x, y, width: el.offsetWidth, height: el.offsetHeight };
  }

  function place(el: HTMLElement, target: StoryTarget | null, pad = 0) {
    if (!target) {
      el.style.opacity = "0";
      return;
    }
    const rect = measure(target);
    el.style.opacity = "1";
    el.style.width = `${rect.width + pad * 2}px`;
    el.style.height = `${rect.height + pad * 2}px`;
    el.style.transform = `translate(${rect.x - pad}px, ${rect.y - pad}px)`;
  }

  function scrollTarget() {
    const top = section.getBoundingClientRect().top;
    return clamp(-top / window.innerHeight, 0, STORY_UNITS);
  }

  function render() {
    const target = scrollTarget();
    current = reduced ? target : current + (target - current) * 0.12;
    if (Math.abs(target - current) < 0.0005) current = target;
    const u = current;
    if (Math.abs(units() - u) > 0.004) setUnits(u);

    const next = replicaAt(u);
    setState(reconcile(next));

    // A stage without layout yet would make every camera scale zero.
    if (!stage.clientWidth || !stage.clientHeight) {
      frame = visible ? requestAnimationFrame(render) : 0;
      return;
    }
    const focus = focusAt(u, stage.clientWidth, stage.clientHeight);
    const camera = cameraAt(u, measure, WORLD_RECT, focus, reduced);
    rig.style.transform =
      `translate3d(${focus.x + focus.width / 2}px, ${focus.y + focus.height / 2}px, 0)` +
      ` rotateX(${camera.rotateX}deg) rotateY(${camera.rotateY}deg)` +
      ` skewY(${camera.skew}deg) scale(${camera.scale})` +
      ` translate(${-camera.x}px, ${-camera.y}px)`;
    rig.style.setProperty("--inverse", String(1 / camera.scale));
    rig.style.opacity = String(1 - span(u, 12.6, 13.3) * 0.55);
    place(ring, next.highlight, 8);
    place(cursor, next.cursor);
    cursor.classList.toggle("pressing", next.pressing);

    frame = visible ? requestAnimationFrame(render) : 0;
  }

  function start() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  function jump(at: number) {
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: top + at * window.innerHeight,
      behavior: reduced ? "auto" : "smooth",
    });
  }

  props.ref?.({ jump });

  onMount(() => {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    current = scrollTarget();
    observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) start();
    });
    observer.observe(section);
    visible = true;
    render();
    setReady(true);
  });

  onCleanup(() => {
    observer?.disconnect();
    // Cleanup also runs while prerendering, where no frame was requested.
    if (frame) cancelAnimationFrame(frame);
  });

  return (
    <section
      ref={(el) => (section = el)}
      class="story"
      classList={{ ready: ready() }}
      style={{ "--units": STORY_UNITS }}
      aria-labelledby="hero-title"
    >
      <div ref={(el) => (stage = el)} class="stage">
        <div class="grain" aria-hidden="true" />
        <For each={storyChapters}>
          {(chapter) => (
            <span
              class="ghost-kanji"
              classList={{ active: active()?.id === chapter.id }}
              lang="ja"
              aria-hidden="true"
            >
              {chapter.kanji}
            </span>
          )}
        </For>

        <div
          ref={(el) => (rig = el)}
          class="rig"
          style={{ width: `${WORLD.width}px`, height: `${WORLD.height}px` }}
        >
          <LandingReplica ref={(el) => (world = el)} state={state} />
          <div ref={(el) => (ring = el)} class="ring" aria-hidden="true" />
          <div ref={(el) => (cursor = el)} class="cursor" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26">
              <path
                d="M4 2l16 9.5-7 1.6 4.2 7.4-3 1.6-4.2-7.5L5 19z"
                fill="#1f1c17"
                stroke="#fbf7e8"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </div>
        <div
          class="veil"
          style={{
            opacity: span(units(), 1, 1.4) * (1 - span(units(), 11.9, 12.3)),
          }}
          aria-hidden="true"
        />

        <div
          class="hero"
          style={{
            opacity: 1 - heroOut(),
            transform: `translateY(${heroOut() * -60}px)`,
            visibility: heroOut() >= 1 ? "hidden" : "visible",
          }}
        >
          <p class="eyebrow">
            <span lang="ja">書く</span> / Japanese input across your devices
          </p>
          <h1 id="hero-title">
            <span class="line">
              <span>Write Japanese</span>
            </span>
            <span class="line">
              <span>on one device.</span>
            </span>
            <span class="line">
              <em>Use it on another.</em>
            </span>
          </h1>
          <p class="hero-lede">
            Handwrite a word or a whole sentence on your tablet, confirm the
            locally recognized text, and send it straight to the focused field
            in your paired browser.
          </p>
          <div class="hero-actions">
            <a class="primary-action" href="/app/">
              Open the writing pad <span aria-hidden="true">→</span>
            </a>
            <button type="button" class="text-action" onClick={() => jump(1.6)}>
              Watch the handoff <span aria-hidden="true">↓</span>
            </button>
          </div>
          <ul class="hero-notes" aria-label="Product highlights">
            <li>Recognition runs locally</li>
            <li>Chromium &amp; Firefox</li>
            <li>Self-hostable</li>
          </ul>
        </div>
        <p
          class="scroll-cue"
          style={{ opacity: 1 - span(units(), 0, 0.3) }}
          aria-hidden="true"
        >
          SCROLL
          <i />
        </p>

        <div class="captions">
          <For each={storyChapters}>
            {(chapter) => (
              <article
                class="caption"
                classList={{ active: active()?.id === chapter.id }}
                aria-labelledby={`chapter-${chapter.id}`}
              >
                <p class="eyebrow">
                  <span lang="ja" aria-hidden="true">
                    {chapter.kanji}
                  </span>
                  {chapter.eyebrow}
                </p>
                <h2 id={`chapter-${chapter.id}`} aria-label={chapter.title}>
                  <For each={chapter.title.split(" ")}>
                    {(word, index) => (
                      <span
                        class="word"
                        style={{ "--i": index() }}
                        aria-hidden="true"
                      >
                        <span>{word}</span>
                      </span>
                    )}
                  </For>
                </h2>
                <p class="caption-body">{chapter.body}</p>
              </article>
            )}
          </For>
        </div>

        <nav
          class="chapters"
          classList={{ shown: Boolean(active()) }}
          aria-label="Walkthrough chapters"
        >
          <span class="chapters-track" aria-hidden="true">
            <span style={{ transform: `scaleY(${progress()})` }} />
          </span>
          <For each={storyChapters}>
            {(chapter) => (
              <button
                type="button"
                classList={{ active: active()?.id === chapter.id }}
                aria-current={active()?.id === chapter.id ? "step" : undefined}
                aria-label={chapter.title}
                onClick={() => jump(chapter.start + 0.45)}
              >
                <span lang="ja" aria-hidden="true">
                  {chapter.kanji}
                </span>
              </button>
            )}
          </For>
        </nav>
        <span class="mobile-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress()})` }} />
        </span>

        <div class="finale" classList={{ active: finale() }}>
          <p class="eyebrow">Ready when you are</p>
          <h2>
            <span class="line">
              <span>Write it here.</span>
            </span>
            <span class="line">
              <em>Use it anywhere.</em>
            </span>
          </h2>
          <div class="finale-actions">
            <a
              class="primary-action"
              href="/app/"
              tabindex={finale() ? undefined : -1}
            >
              Open the writing pad <span aria-hidden="true">→</span>
            </a>
            <a
              class="text-action"
              href="#download"
              tabindex={finale() ? undefined : -1}
            >
              Get the browser receiver <span aria-hidden="true">↓</span>
            </a>
          </div>
          <p>Free, open source, and yours to self-host.</p>
        </div>
      </div>
    </section>
  );
}
