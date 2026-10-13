import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const webRoot = dirname(fileURLToPath(import.meta.url));
const ortVersion = "1.22.0";

interface PackageInfo {
  name: string;
  version: string;
  license?: string;
}

// Main and worker builds share the inventory, including worker-only imports.
export function licenseNotices() {
  const packages = new Map<string, { root: string; info: PackageInfo }>();

  function recordPackage(id: string) {
    if (!id.includes("node_modules/") || id.startsWith("\0")) return;
    let directory = dirname(id.split("?")[0]!);
    while (directory !== dirname(directory)) {
      const manifest = join(directory, "package.json");
      if (existsSync(manifest)) {
        const info = JSON.parse(readFileSync(manifest, "utf8")) as PackageInfo;
        if (info.name && info.version) {
          packages.set(`${info.name}@${info.version}`, {
            root: directory,
            info,
          });
          return;
        }
      }
      directory = dirname(directory);
    }
    throw new Error(`Cannot identify bundled dependency: ${id}`);
  }

  function plugin(worker = false): Plugin {
    return {
      name: "kaku-license-notices",
      apply: "build",
      buildStart() {
        if (!worker) packages.clear();
      },
      generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type !== "chunk") continue;
          for (const [id, module] of Object.entries(output.modules)) {
            if (module.renderedLength > 0) recordPackage(id);
          }
        }
        if (worker) return;

        const ortRoot = join(webRoot, "node_modules/onnxruntime-web");
        const ortInfo = JSON.parse(
          readFileSync(join(ortRoot, "package.json"), "utf8"),
        ) as PackageInfo;
        if (ortInfo.version !== ortVersion) {
          throw new Error(
            "Update the vendored ONNX Runtime notices for this version.",
          );
        }
        for (const asset of [
          "ort-wasm-simd-threaded.mjs",
          "ort-wasm-simd-threaded.wasm",
        ]) {
          if (
            !readFileSync(join(webRoot, "public/ort", asset)).equals(
              readFileSync(join(ortRoot, "dist", asset)),
            )
          ) {
            throw new Error(
              `Self-hosted ONNX Runtime asset does not match ${ortVersion}: ${asset}`,
            );
          }
        }

        const sections = [
          "Kaku — third-party software notices\n\nGenerated from the browser and worker bundles.\nThe complete ONNX Runtime third-party notice collection is retained; some entries concern other backends.",
          "DaKanji Single Kanji Recognition v2.0\nCharacter recognition powered by machine learning from CaptainDario (DaAppLab).\nhttps://github.com/dariyooo/DaKanji-Single-Kanji-Recognition/releases/tag/v2.0\n\n" +
            readFileSync(
              join(webRoot, "public/models/dakanji/LICENSE.txt"),
              "utf8",
            ),
        ];
        // ONNX's WASM JS bundle embeds onnxruntime-common; upstream notices
        // also cover the native dependencies inside the precompiled WASM.
        const ortNotices = join(webRoot, `licenses/onnxruntime-${ortVersion}`);
        sections.push(
          `onnxruntime-web / onnxruntime-common ${ortVersion}\nhttps://github.com/microsoft/onnxruntime/tree/v${ortVersion}\n\n` +
            readFileSync(join(ortNotices, "LICENSE"), "utf8"),
        );

        for (const { root, info } of [...packages.values()].sort((a, b) =>
          a.info.name.localeCompare(b.info.name),
        )) {
          if (
            info.name === "onnxruntime-web" ||
            info.name === "onnxruntime-common"
          ) {
            if (info.version !== ortVersion)
              throw new Error("ONNX Runtime notice version mismatch.");
            continue;
          }
          const files = readdirSync(root)
            .filter((name) =>
              /^(licen[cs]e|copying|notice)([._-].*)?$/i.test(name),
            )
            .sort();
          if (!files.some((name) => /^(licen[cs]e|copying)/i.test(name))) {
            throw new Error(
              `Missing license text for ${info.name}@${info.version}. Vendor its upstream license before shipping.`,
            );
          }
          sections.push(
            `${info.name} ${info.version} (${info.license ?? "see license below"})\n\n` +
              files
                .map((name) => readFileSync(join(root, name), "utf8"))
                .join("\n\n"),
          );
        }
        sections.push(
          readFileSync(join(ortNotices, "ThirdPartyNotices.txt"), "utf8"),
        );
        const source =
          sections.join("\n\n========================================\n\n") +
          "\n";
        this.emitFile({
          type: "asset",
          fileName: "licenses/THIRD_PARTY_NOTICES.txt",
          source,
        });
        // Keep an offline snapshot available to the development server too.
        writeFileSync(
          join(webRoot, "public/licenses/THIRD_PARTY_NOTICES.txt"),
          source,
        );
      },
    };
  }

  return { main: plugin(), worker: () => plugin(true) };
}
