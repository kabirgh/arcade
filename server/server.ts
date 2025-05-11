import { serve } from "bun";
import index from "../client/index.html";
import { CODENAMES_ROUTES } from "./codenames";

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,
    ...CODENAMES_ROUTES,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },

  hostname: "0.0.0.0",
  port: 3001,
});
