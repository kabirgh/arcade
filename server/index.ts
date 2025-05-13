import path from "path";
import { Elysia } from "elysia";
import { ElysiaWS } from "elysia/dist/ws";
import { staticPlugin } from "@elysiajs/static";
import { html } from "@elysiajs/html";
import type { Player } from "../shared/types/player";
import {
  Channel,
  WebSocketMessageType,
  type WebSocketMessage,
  MessageType,
  type AllPlayersMessage,
} from "../shared/types/websocket";
import { APIRoute, APIRouteToRequestSchema } from "../shared/types/routes";
import {
  handleCodenamesState,
  handleCodenamesStart,
  handleCodenamesClue,
  handleCodenamesGuess,
  handleCodenamesEndTurn,
} from "./codenames";

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

function broadcastAllPlayers(): AllPlayersMessage {
  const message: AllPlayersMessage = {
    channel: Channel.PLAYER,
    messageType: MessageType.ALL_PLAYERS,
    payload: getPlayers(),
  };
  broadcast(message);
  return message;
}

const handleWebSocketMessage = (ws: ElysiaWS, message: WebSocketMessage) => {
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
};

const app = new Elysia()
  .ws("/ws", {
    body: WebSocketMessageType,
    message(ws, message: WebSocketMessage) {
      handleWebSocketMessage(ws, message);
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
  })
  .get(
    APIRoute.Screen,
    () => {
      return { screen };
    },
    { body: APIRouteToRequestSchema[APIRoute.Screen] }
  )
  .get(
    APIRoute.Players,
    () => {
      return getPlayers();
    },
    { body: APIRouteToRequestSchema[APIRoute.Players] }
  )
  .get(
    APIRoute.ListWebSocketClientIds,
    () => {
      return [...clients.keys()].map((ws) => ws.id);
    },
    { body: APIRouteToRequestSchema[APIRoute.ListWebSocketClientIds] }
  )
  .post(
    APIRoute.SendWebSocketMessage,
    ({ body }) => {
      const ws = [...clients.keys()].find((ws) => ws.id === body.id);
      if (!ws) {
        return { success: false, error: "Client not found" };
      }
      handleWebSocketMessage(ws, body.message);
      return { success: true };
    },
    { body: APIRouteToRequestSchema[APIRoute.SendWebSocketMessage] }
  )
  .post(
    APIRoute.BroadcastAllPlayers,
    () => {
      return broadcastAllPlayers();
    },
    { body: APIRouteToRequestSchema[APIRoute.BroadcastAllPlayers] }
  )
  .get(
    APIRoute.CodenamesState,
    () => {
      return handleCodenamesState();
    },
    { body: APIRouteToRequestSchema[APIRoute.CodenamesState] }
  )
  .post(
    APIRoute.CodenamesStart,
    () => {
      return handleCodenamesStart();
    },
    { body: APIRouteToRequestSchema[APIRoute.CodenamesStart] }
  )
  .post(
    APIRoute.CodenamesClue,
    ({ body }) => {
      return handleCodenamesClue(body);
    },
    { body: APIRouteToRequestSchema[APIRoute.CodenamesClue] }
  )
  .post(
    APIRoute.CodenamesGuess,
    ({ body }) => {
      return handleCodenamesGuess(body);
    },
    { body: APIRouteToRequestSchema[APIRoute.CodenamesGuess] }
  )
  .post(
    APIRoute.CodenamesEndTurn,
    () => {
      return handleCodenamesEndTurn();
    },
    { body: APIRouteToRequestSchema[APIRoute.CodenamesEndTurn] }
  );

// Add catch-all route last so API routes above are matched before the SPA catch-all
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
