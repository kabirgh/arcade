import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import { defineConfig } from "vite";

import config from "../config.ts";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target:
          config.mode === "internet"
            ? `https://localhost:${config.internet.port}`
            : `http://localhost:${config.local.server.port}`,
        changeOrigin: true,
        secure: false, // Allow self-signed certs in dev
      },
      "/ws": {
        target:
          config.mode === "internet"
            ? `wss://localhost:${config.internet.port}`
            : `ws://localhost:${config.local.server.port}`,
        ws: true,
        secure: false,
      },
    },
    host: true, // bind to all interfaces including 0.0.0.0
    port: config.local.vite.port,
    // Enable HTTPS in dev mode when using internet mode (for testing wss://)
    ...(config.mode === "internet" &&
    fs.existsSync(config.internet.tls.certPath)
      ? {
          https: {
            key: fs.readFileSync(config.internet.tls.keyPath),
            cert: fs.readFileSync(config.internet.tls.certPath),
          },
        }
      : {}),
  },
});
