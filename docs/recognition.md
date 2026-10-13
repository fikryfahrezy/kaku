# Local handwriting recognition

Kaku uses the **DaKanji Single Kanji Recognition v2.0** classifier for
milestone 3. The self-hosted model accepts a 96×96 grayscale character image
and returns probabilities for 6,000+ character labels, including kanji,
hiragana, and katakana. It is small enough for a
browser-based writing app, runs with ONNX Runtime Web's single-threaded WASM
backend, and does not need WebGL, cross-origin isolation, or a recognition
service.

The model is distributed under the MIT license. Its required license text is
kept beside the model at `apps/web/public/models/dakanji/LICENSE.txt`. The
model originates from the official DaKanji Single Kanji Recognition v2.0
release: <https://github.com/dariyooo/DaKanji-Single-Kanji-Recognition/releases/tag/v2.0>.

## Pipeline

1. Pointer samples record normalized position, pressure, timestamp, pointer
   kind, and a continuously updated stroke bound.
2. The writing surface assigns strokes to visible character cells and orders
   non-empty cells left-to-right, top-to-bottom. This supports long sentences
   and multiple lines without transmitting ink.
3. A dedicated Web Worker rasterizes each group, normalizes it to 96×96, runs
   local ONNX inference, and retains the top five kanji, hiragana, or katakana
   candidates by probability.
4. A width-five beam search combines the top three candidates per group into
   ranked sentence suggestions. The user must confirm or edit the result before
   delivery.

Recognition supports kanji and the hiragana and katakana present in the bundled
model's label map. Kana coverage is incomplete; characters absent from that map
and punctuation should be entered through the accessible typed fallback or
added while editing the confirmed sentence. Write each character in its own
cell, keeping dakuten and handakuten in the same cell as the base character.

## Caching and measurement

The model, labels, MIT license, and ONNX WASM runtime are cached under
`kaku-model-v1` by `model-cache-worker.js`. The worker also uses the
Cache API directly for the model and label map, so a repeat visit remains
cached even before the service worker controls the page.

The UI reports the exact model download size, model/session load duration,
latest total inference latency, and an estimated working-asset footprint
(model + WASM runtime + input tensors). Repository asset sizes are approximately
2.1 MiB for the model and 10.7 MiB for WASM. Release checks on representative
devices and browsers should record cold/warm latency and, where available,
process-memory values; browser JavaScript cannot read real process memory directly.
