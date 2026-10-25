import { defineConfig } from "vite";
import { solidStart } from "@solidjs/start/config";
import { nitro } from "nitro/vite";
import { licenseNotices } from "./license-notices.ts";

const notices = licenseNotices();

export default defineConfig(({ command }) => ({
  plugins: [solidStart(), nitro(), notices.main],
  worker: {
    plugins: () => [notices.worker()],
    // Nitro's buildAssetsDir does not reach worker bundles.
    rolldownOptions: { output: { entryFileNames: "assets/[name]-[hash].js" } },
  },
  // Dev serves from source; a build output dir in dev would shadow the routes.
  nitro:
    command === "build"
      ? {
          preset: "static",
          // apps/server serves these files, so emit them where it already looks.
          output: { dir: ".output", publicDir: "dist" },
          // Keep hashed files under /assets/, which the server caches as immutable.
          buildAssetsDir: "assets",
          prerender: {
            routes: ["/", "/app/", "/licenses/"],
            crawlLinks: false,
            failOnError: true,
          },
        }
      : {},
  server: {
    proxy: {
      // "/api": "http://127.0.0.1:3000",
      "/api": "https://kaku.fahrezy.work",
      // "/healthz": "http://127.0.0.1:3000",
      "/healthz": "https://kaku.fahrezy.work",
      "/ws": {
        // target: "ws://127.0.0.1:3000",
        target: "wss://kaku.fahrezy.work",
        ws: true,
      },
    },
  },
}));
