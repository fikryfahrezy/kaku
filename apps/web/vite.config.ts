import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [solid()],
  build: {
    rollupOptions: {
      input: {
        landing: resolve("index.html"),
        app: resolve("app/index.html"),
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
