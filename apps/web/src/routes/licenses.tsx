import { PageHead } from "../PageHead";
import "../licenses.css";

export default function Licenses() {
  return (
    <main class="licenses-page">
      <PageHead
        title="Open-source licenses · Kaku"
        meta={[
          { name: "viewport", content: "width=device-width, initial-scale=1" },
        ]}
      />
      <a href="/" rel="external">
        ← Kaku home
      </a>
      <h1>Open-source licenses</h1>
      <p>
        Kaku is built with open-source software. We thank the authors and
        contributors who make it possible.
      </p>
      <section aria-labelledby="recognition-credit">
        <h2 id="recognition-credit">Handwriting recognition</h2>
        <p>
          Character recognition powered by machine learning from CaptainDario
          (DaAppLab).
        </p>
        <p>
          We use{" "}
          <a href="https://github.com/dariyooo/DaKanji-Single-Kanji-Recognition/releases/tag/v2.0">
            DaKanji Single Kanji Recognition v2.0
          </a>
          , licensed under MIT. Copyright (c) 2021 CaptainDario.
        </p>
        <a href="/models/dakanji/LICENSE.txt">Read the full DaKanji license</a>
      </section>
      <section aria-labelledby="software-notices">
        <h2 id="software-notices">Software notices</h2>
        <p>
          The full notices include license texts, copyright notices, and
          versions for the packages bundled into the browser app, plus ONNX
          Runtime's upstream third-party notices for its WASM runtime.
        </p>
        <p>
          <a href="/licenses/THIRD_PARTY_NOTICES.txt">
            Read all third-party notices
          </a>
        </p>
        <p>
          <a href="/app/" rel="external">
            Open the writing pad →
          </a>
        </p>
      </section>
    </main>
  );
}
