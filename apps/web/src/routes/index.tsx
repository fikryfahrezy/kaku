import { createSignal, onMount } from "solid-js";
import { LandingStory } from "../LandingStory";
import type { LandingStoryHandle } from "../LandingStory";
import { PageHead } from "../PageHead";
import "../styles.css";
import "../landing.css";

const LATEST_RELEASE_URL =
  "https://github.com/fikryfahrezy/kaku/releases/latest";

interface ReleaseAsset {
  name: string;
  browser_download_url?: string;
}

interface Release {
  tag_name?: unknown;
  assets?: unknown;
}

async function fetchLatestRelease(): Promise<Release | undefined> {
  try {
    const response = await fetch(
      "https://api.github.com/repos/fikryfahrezy/kaku/releases/latest",
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (!response.ok) return undefined;
    return (await response.json()) as Release;
  } catch {
    // Keep the latest release page as a usable fallback.
    return undefined;
  }
}

function Brand(props: { caption?: boolean }) {
  return (
    <a class="brand" href="/" aria-label="Kaku home">
      <span class="brand-mark" lang="ja" aria-hidden="true">
        書
      </span>
      {props.caption ? (
        <span class="brand-name">
          Kaku
          <span class="brand-caption">JAPANESE HANDWRITING INPUT</span>
        </span>
      ) : (
        <span>Kaku</span>
      )}
    </a>
  );
}

export default function Landing() {
  // Fetch in the browser so the prerendered page never pins a stale release.
  const [release, setRelease] = createSignal<Release>();
  onMount(() => void fetchLatestRelease().then(setRelease));
  let story: LandingStoryHandle | undefined;

  const releaseLabel = () => {
    const tag = release()?.tag_name;
    return typeof tag === "string" ? tag : "Latest release";
  };

  const assetUrl = (prefix: string) => {
    const assets = release()?.assets;
    if (!Array.isArray(assets)) return LATEST_RELEASE_URL;
    const asset = (assets as ReleaseAsset[]).find(
      ({ name }) => name.startsWith(prefix) && name.endsWith(".zip"),
    );
    return asset?.browser_download_url ?? LATEST_RELEASE_URL;
  };

  return (
    <div class="landing-shell">
      <PageHead
        title="Kaku — Write Japanese here, use it anywhere"
        meta={[
          {
            name: "viewport",
            content: "width=device-width, initial-scale=1, viewport-fit=cover",
          },
          { name: "theme-color", content: "#e3ded0" },
          {
            name: "description",
            content:
              "Handwrite Japanese on one device, choose the matching text, and send it to any input in your paired browser.",
          },
          { name: "robots", content: "index,follow" },
          { property: "og:type", content: "website" },
          {
            property: "og:title",
            content: "Kaku — Write here, use it anywhere",
          },
          {
            property: "og:description",
            content:
              "Handwrite Japanese on one device and send the matched text to your paired browser.",
          },
          { property: "og:locale", content: "en_US" },
          { name: "twitter:card", content: "summary" },
        ]}
      />
      <a class="skip-link" href="#main">
        Skip to content
      </a>
      <header class="landing-nav">
        <Brand caption />
        <nav aria-label="Main navigation">
          <button type="button" onClick={() => story?.jump(1.6)}>
            How it works
          </button>
          <a href="#download">Get the extension</a>
        </nav>
        <a class="nav-cta" href="/app/">
          Open writing pad <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main id="main">
        <LandingStory ref={(handle) => (story = handle)} />

        <section
          class="extension-download"
          id="download"
          aria-labelledby="download-title"
        >
          <div class="section-heading extension-heading">
            <div>
              <p class="eyebrow">Browser receivers · {releaseLabel()}</p>
              <h2 id="download-title">
                Install the other half
                <br />
                of the handoff.
              </h2>
            </div>
            <p>
              Choose the browser where you want Japanese text to arrive. The
              extension connects that browser to the writing pad on your other
              device.
            </p>
          </div>

          <div class="browser-downloads">
            <article class="browser-card">
              <header class="browser-card-heading">
                <div>
                  <p class="browser-kicker">Chrome · Edge · Brave</p>
                  <h3>Chromium</h3>
                </div>
                <span class="browser-format">ZIP</span>
              </header>

              <a
                class="download-action"
                href={assetUrl("kaku-chromium-")}
                download=""
              >
                Download for Chromium <span aria-hidden="true">↓</span>
              </a>

              <ol class="install-steps">
                <li>
                  <span>01</span>
                  <p>
                    Download the ZIP above, then extract it to a folder you will
                    keep.
                  </p>
                </li>
                <li>
                  <span>02</span>
                  <p>
                    Open <code>chrome://extensions</code>. Use{" "}
                    <code>edge://extensions</code> or{" "}
                    <code>brave://extensions</code> in those browsers.
                  </p>
                </li>
                <li>
                  <span>03</span>
                  <p>
                    Turn on <strong>Developer mode</strong>, choose{" "}
                    <strong>Load unpacked</strong>, and select the extracted
                    folder.
                  </p>
                </li>
                <li>
                  <span>04</span>
                  <p>
                    Open Kaku from the extensions menu and request a pairing
                    code.
                  </p>
                </li>
              </ol>
            </article>

            <article class="browser-card">
              <header class="browser-card-heading">
                <div>
                  <p class="browser-kicker">Firefox desktop</p>
                  <h3>Firefox</h3>
                </div>
                <span class="browser-format">ZIP</span>
              </header>

              <a
                class="download-action"
                href={assetUrl("kaku-firefox-")}
                download=""
              >
                Download for Firefox <span aria-hidden="true">↓</span>
              </a>

              <ol class="install-steps">
                <li>
                  <span>01</span>
                  <p>
                    Download and extract the ZIP, then open{" "}
                    <code>about:debugging#/runtime/this-firefox</code>.
                  </p>
                </li>
                <li>
                  <span>02</span>
                  <p>
                    Choose <strong>Load Temporary Add-on</strong> and select{" "}
                    <code>manifest.json</code> inside the extracted folder.
                  </p>
                </li>
                <li>
                  <span>03</span>
                  <p>
                    Open Kaku from the extensions menu and request a pairing
                    code.
                  </p>
                </li>
                <li>
                  <span>04</span>
                  <p>
                    For a permanent install, use the signed XPI when it is
                    available on the{" "}
                    <a href={LATEST_RELEASE_URL}>latest release</a>.
                  </p>
                </li>
              </ol>

              <p class="browser-note">
                <span aria-hidden="true">!</span> Unsigned temporary add-ons are
                removed when Firefox restarts.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer class="landing-footer">
        <Brand />
        <p>Handwrite on one device. Continue on another.</p>
        {/* A full load keeps the landing styles from leaking into that page. */}
        <a href="/licenses/" rel="external">
          Open-source licenses
        </a>
        <span>Browser handwriting input · 2026</span>
      </footer>
    </div>
  );
}
