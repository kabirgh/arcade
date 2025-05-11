import { Elysia, NotFoundError } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { html } from "@elysiajs/html";
import { addCodenamesRoutes } from "./codenames";
import path from "path";

const app = new Elysia().ws("/ws", {
  message(ws, message) {
    console.log(message);
    ws.send(JSON.stringify({ type: "join" }));
  },
  open(ws) {
    console.log("open");
  },
  close(ws) {
    console.log("close");
  },
});

// Add API routes first so they are matched before the SPA catch-all
addCodenamesRoutes(app);

if (process.env.NODE_ENV === "production") {
  // Path to index.html relative to the executable's directory
  const pathToIndexHTML = path.join(
    path.dirname(process.execPath),
    "client",
    "dist",
    "index.html"
  );
  const indexHTML = await Bun.file(pathToIndexHTML).text();

  app
    .use(html()) // Enables HTML templating
    .use(
      staticPlugin({
        assets: "client\\dist", // Do not change: must be escaped backslash to work on Windows
        prefix: "/",
      })
    )
    // This catch-all route serves the SPA's index.html for any non-API, non-static-file requests.
    .get("*", ({ html }) => html(indexHTML));
}

app.listen(3001);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
