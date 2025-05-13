import { Elysia, t } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { html } from "@elysiajs/html";
import {
  handleCodenamesState,
  handleCodenamesStart,
  handleCodenamesClue,
  handleCodenamesGuess,
  handleCodenamesEndTurn,
} from "./codenames";
import path from "path";
import {
  Channel,
  WebSocketMessageType,
  type WebSocketMessage,
  MessageType,
} from "../shared/types/websocket";
import { ElysiaWS } from "elysia/dist/ws";
import type { Player, Color, Avatar } from "../shared/types/player";
import { APIRoute } from "../shared/types/routes";
import {
  CodenamesClueRequestType,
  CodenamesGuessRequestType,
  CodenamesEndTurnRequestType,
  CodenamesStartRequestType,
} from "../shared/types/codenames";

type Client = {
  player: Player | null;
};

const clients = new Map<ElysiaWS, Client>();
let screen: string = "join";

function getPlayers(): Player[] {
  return Array.from(clients.values())
    .filter((client) => client.player !== null)
    .map((client) => client.player!);
}

function broadcast(message: WebSocketMessage): void {
  console.log("Broadcasting message:", message);
  for (const [ws, _client] of clients.entries()) {
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
  body: WebSocketMessageType,
  message(ws, message: WebSocketMessage) {
    console.log("Received message:", message);

    switch (message.channel) {
      case Channel.PLAYER:
        switch (message.messageType) {
          case MessageType.JOIN:
            // TODO: Check if the player is already in the list, validate no overlapping avatars
            // Define and send error message type
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
// Retrieve the current screen
app
  .get(APIRoute.Screen, () => {
    return { screen };
  })
  .get(APIRoute.Players, () => {
    return getPlayers();
  })
  .post(
    APIRoute.Broadcast,
    ({ body }) => {
      broadcast(body);
      return { success: true };
    },
    { body: WebSocketMessageType }
  )
  .get(
    APIRoute.CodenamesState,
    () => {
      return handleCodenamesState();
    },
    { body: CodenamesClueRequestType }
  )
  .post(
    APIRoute.CodenamesStart,
    () => {
      return handleCodenamesStart();
    },
    { body: CodenamesStartRequestType }
  )
  .post(
    APIRoute.CodenamesClue,
    ({ body }) => {
      return handleCodenamesClue(body);
    },
    { body: CodenamesClueRequestType }
  )
  .post(
    APIRoute.CodenamesGuess,
    ({ body }) => {
      return handleCodenamesGuess(body);
    },
    { body: CodenamesGuessRequestType }
  )
  .post(
    APIRoute.CodenamesEndTurn,
    () => {
      return handleCodenamesEndTurn();
    },
    { body: CodenamesEndTurnRequestType }
  );

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
