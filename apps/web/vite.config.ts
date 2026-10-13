import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { resolve } from "node:path";
import { licenseNotices } from "./license-notices";

const notices = licenseNotices();

export default defineConfig({
  plugins: [solid(), notices.main],
  worker: { plugins: () => [notices.worker()] },
  build: {
    rollupOptions: {
      input: {
        landing: resolve("index.html"),
        app: resolve("app/index.html"),
        licenses: resolve("licenses/index.html"),
      },
    },
  },
  server: {
    proxy: {
      // "/api": "http://127.0.0.1:3000",
      "/api": "http://kaku.fahrezy.work",
      // "/healthz": "http://127.0.0.1:3000",
      "/healthz": "http://kaku.fahrezy.work",
      "/ws": {
        // target: "ws://127.0.0.1:3000",
        target: "wss://kaku.fahrezy.work",
        ws: true,
      },
    },
  },
});
