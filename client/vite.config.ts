import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import config from "../config.ts";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: `http://localhost:${config.server.port}`,
        changeOrigin: true,
      },
    },
    host: true, // bind to all interfaces including 0.0.0.0
    port: config.vite.port,
  },
});
