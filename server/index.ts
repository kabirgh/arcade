import path from "path";
import { Elysia } from "elysia";
import { ElysiaWS } from "elysia/dist/ws";
import { staticPlugin } from "@elysiajs/static";
import { html } from "@elysiajs/html";
import { Color, type Player } from "../shared/types/domain/player";
import { Channel, MessageType } from "../shared/types/domain/websocket";
import { APIRoute, APIRouteToSchema } from "../shared/types/api/schema";
import {
  handleCodenamesState,
  handleCodenamesStart,
  handleCodenamesClue,
  handleCodenamesGuess,
  handleCodenamesEndTurn,
} from "./codenames";
import {
  type PlayerListAllMessage,
  type WebSocketMessage,
  WebSocketMessageType,
} from "../shared/types/api/websocket";

type Client = {
  player: Player | null;
};

const teams = [
  { name: "Team 1", color: Color.Red },
  { name: "Team 2", color: Color.Blue },
  { name: "Team 3", color: Color.Green },
  { name: "Team 4", color: Color.Yellow },
];
const clients = new Map<ElysiaWS, Client>();
const screen: string = "join";

function getPlayers(): Player[] {
  return Array.from(clients.values())
    .filter((client) => client.player !== null)
    .map((client) => client.player!);
}

function broadcast(message: WebSocketMessage): void {
  console.log("Broadcasting message:", message);
  for (const ws of clients.keys()) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastAllPlayers(): PlayerListAllMessage {
  const message: PlayerListAllMessage = {
    channel: Channel.PLAYER,
    messageType: MessageType.LIST,
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
        case MessageType.LIST:
          break;
      }
      broadcastAllPlayers();
      break;
    case Channel.BUZZER:
      switch (message.messageType) {
        case MessageType.BUZZ:
          broadcast(message);
          break;
        case MessageType.RESET:
          broadcast(message);
          break;
      }
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
    APIRoute.PlayerScreen,
    () => {
      return { screen };
    },
    { body: APIRouteToSchema[APIRoute.PlayerScreen].req }
  )
  .post(
    APIRoute.SetPlayerScreen,
    () => {
      // TODO
    },
    { body: APIRouteToSchema[APIRoute.SetPlayerScreen].req }
  )
  .get(
    APIRoute.Teams,
    () => {
      return teams;
    },
    { body: APIRouteToSchema[APIRoute.Teams].req }
  )
  .get(
    APIRoute.Players,
    () => {
      return getPlayers();
    },
    { body: APIRouteToSchema[APIRoute.Players].req }
  )
  // Admin
  // TODO: return id: player map
  .get(
    APIRoute.ListWebSocketClientIds,
    () => {
      return [...clients.keys()].map((ws) => ws.id);
    },
    { body: APIRouteToSchema[APIRoute.ListWebSocketClientIds].req }
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
    { body: APIRouteToSchema[APIRoute.SendWebSocketMessage].req }
  )
  .post(
    APIRoute.BroadcastAllPlayers,
    () => {
      return broadcastAllPlayers();
    },
    { body: APIRouteToSchema[APIRoute.BroadcastAllPlayers].req }
  )
  // Codenames
  .get(
    APIRoute.CodenamesState,
    () => {
      return handleCodenamesState();
    },
    { body: APIRouteToSchema[APIRoute.CodenamesState].req }
  )
  .post(
    APIRoute.CodenamesStart,
    () => {
      return handleCodenamesStart();
    },
    { body: APIRouteToSchema[APIRoute.CodenamesStart].req }
  )
  .post(
    APIRoute.CodenamesClue,
    ({ body }) => {
      return handleCodenamesClue(body);
    },
    { body: APIRouteToSchema[APIRoute.CodenamesClue].req }
  )
  .post(
    APIRoute.CodenamesGuess,
    ({ body }) => {
      return handleCodenamesGuess(body);
    },
    { body: APIRouteToSchema[APIRoute.CodenamesGuess].req }
  )
  .post(
    APIRoute.CodenamesEndTurn,
    () => {
      return handleCodenamesEndTurn();
    },
    { body: APIRouteToSchema[APIRoute.CodenamesEndTurn].req }
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
