import { Elysia, t } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { html } from "@elysiajs/html";
import { addCodenamesRoutes } from "./codenames";
import path from "path";
import {
  Channel,
  MessageType,
  type WebSocketMessage,
} from "../shared/types/websocket";
import { ElysiaWS } from "elysia/dist/ws";
import { Player } from "../shared/types/player";

type Client = {
  player: Player | null;
};

const clients = new Map<ElysiaWS, Client>();

function getPlayers(): Player[] {
  return Array.from(clients.values())
    .filter((client) => client.player !== null)
    .map((client) => client.player!);
}

function broadcast(message: WebSocketMessage): void {
  console.log("Broadcasting message:", message);
  for (const [ws, client] of clients.entries()) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastAllPlayers(): void {
  broadcast({
    channel: Channel.PLAYER,
    messageType: MessageType.ALL_PLAYERS,
    payload: getPlayers(),
  });
}

const app = new Elysia().ws("/ws", {
  body: t.Object({
    channel: t.Enum(Channel),
    messageType: t.Enum(MessageType),
    payload: t.Optional(t.Any()),
  }),
  message(ws, message: WebSocketMessage) {
    console.log("Received message:", message);

    switch (message.channel) {
      case Channel.PLAYER:
        switch (message.messageType) {
          case MessageType.JOIN:
            clients.set(ws, { player: message.payload });
            break;
          case MessageType.LEAVE:
            clients.set(ws, { player: null });
            break;
          case MessageType.ALL_PLAYERS:
            break;
        }
        broadcastAllPlayers();
        break;
      default:
        console.error("Unknown channel:", message.channel);
        break;
    }
  },
  open(ws) {
    console.log("Client connected:", ws.id);
    clients.set(ws, { player: null });
  },
  close(ws) {
    console.log("Client disconnected:", ws.id);
    clients.delete(ws);
    broadcastAllPlayers();
  },
});

// Add API routes first so they are matched before the SPA catch-all
addCodenamesRoutes(app);

app.get("/players", () => {
  return getPlayers();
});

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
