import path from "path";
import { Elysia } from "elysia";
import { ElysiaWS } from "elysia/dist/ws";
import { staticPlugin } from "@elysiajs/static";
import { html } from "@elysiajs/html";
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
import DB from "./db";

const db = new DB();

function broadcast(message: WebSocketMessage): void {
  console.log("Broadcasting message:", message);

  for (const ws of db.wsPlayerMap.keys()) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastAllPlayers(): PlayerListAllMessage {
  const message: PlayerListAllMessage = {
    channel: Channel.PLAYER,
    messageType: MessageType.LIST,
    payload: db.players,
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
          for (const [otherWs, player] of db.wsPlayerMap.entries()) {
            if (otherWs === ws) {
              continue;
            }
            if (player !== null && player.id === message.payload.id) {
              // We found a player with the same id in the list.
              // This means the websocket id has changed (usually due to a reconnect).
              // Remove the old player from the list and add the new one
              db.wsPlayerMap.set(otherWs, null);
              db.wsPlayerMap.set(ws, message.payload);
              // Don't need to broadcast player list because only the websocket
              // id changed, which the client doesn't need to know
              return;
            }
          }
          // Didn't find a player with the same id, so add this player to the list
          db.wsPlayerMap.set(ws, message.payload);
          break;

        case MessageType.LEAVE:
          db.wsPlayerMap.set(ws, null);
          break;

        case MessageType.LIST:
          break;
      }
      // Broadcast the player list to all clients
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
    },
    close(ws) {
      console.log("Client disconnected:", ws.id);
      // Don't remove player from db.wsPlayerMap because they may reconnect.
      // Handle reconnections in the JOIN message handler.
    },
  })
  .get(
    APIRoute.PlayerScreen,
    () => {
      return { screen: db.screen };
    },
    {
      body: APIRouteToSchema[APIRoute.PlayerScreen].req,
      response: APIRouteToSchema[APIRoute.PlayerScreen].res,
    }
  )
  .post(
    APIRoute.SetPlayerScreen,
    ({ body }) => {
      db.screen = body.screen;
      return { success: true };
    },
    {
      body: APIRouteToSchema[APIRoute.SetPlayerScreen].req,
      response: APIRouteToSchema[APIRoute.SetPlayerScreen].res,
    }
  )
  .get(
    APIRoute.ListTeams,
    () => {
      return { teams: db.teams };
    },
    {
      body: APIRouteToSchema[APIRoute.ListTeams].req,
      response: APIRouteToSchema[APIRoute.ListTeams].res,
    }
  )
  .post(
    APIRoute.SetTeamName,
    ({ body }) => {
      const team = db.teams.find((team) => team.id === body.teamId);
      if (!team) {
        return { success: false, error: "Team not found" };
      }
      team.name = body.name;

      return { success: true };
    },
    {
      body: APIRouteToSchema[APIRoute.SetTeamName].req,
      response: APIRouteToSchema[APIRoute.SetTeamName].res,
    }
  )
  .get(
    APIRoute.ListPlayers,
    () => {
      return { players: db.players };
    },
    {
      body: APIRouteToSchema[APIRoute.ListPlayers].req,
      response: APIRouteToSchema[APIRoute.ListPlayers].res,
    }
  )
  // Admin
  .get(
    APIRoute.ListWebSocketClientIds,
    () => {
      return { ids: [...db.wsPlayerMap.keys()].map((ws) => ws.id) };
    },
    {
      body: APIRouteToSchema[APIRoute.ListWebSocketClientIds].req,
      response: APIRouteToSchema[APIRoute.ListWebSocketClientIds].res,
    }
  )
  .post(
    APIRoute.SendWebSocketMessage,
    ({ body }) => {
      const ws = [...db.wsPlayerMap.keys()].find((ws) => ws.id === body.id);
      if (!ws) {
        return { success: false, error: "Client not found" };
      }
      handleWebSocketMessage(ws, body.message);
      return { success: true };
    },
    {
      body: APIRouteToSchema[APIRoute.SendWebSocketMessage].req,
      response: APIRouteToSchema[APIRoute.SendWebSocketMessage].res,
    }
  )
  .post(
    APIRoute.BroadcastAllPlayers,
    () => {
      broadcastAllPlayers();
      return { success: true };
    },
    {
      body: APIRouteToSchema[APIRoute.BroadcastAllPlayers].req,
      response: APIRouteToSchema[APIRoute.BroadcastAllPlayers].res,
    }
  )
  // Codenames
  .get(
    APIRoute.CodenamesState,
    () => {
      return handleCodenamesState();
    },
    {
      body: APIRouteToSchema[APIRoute.CodenamesState].req,
      response: APIRouteToSchema[APIRoute.CodenamesState].res,
    }
  )
  .post(
    APIRoute.CodenamesStart,
    () => {
      return handleCodenamesStart();
    },
    {
      body: APIRouteToSchema[APIRoute.CodenamesStart].req,
      response: APIRouteToSchema[APIRoute.CodenamesStart].res,
    }
  )
  .post(
    APIRoute.CodenamesClue,
    ({ body }) => {
      return handleCodenamesClue(body);
    },
    {
      body: APIRouteToSchema[APIRoute.CodenamesClue].req,
      response: APIRouteToSchema[APIRoute.CodenamesClue].res,
    }
  )
  .post(
    APIRoute.CodenamesGuess,
    ({ body }) => {
      return handleCodenamesGuess(body);
    },
    {
      body: APIRouteToSchema[APIRoute.CodenamesGuess].req,
      response: APIRouteToSchema[APIRoute.CodenamesGuess].res,
    }
  )
  .post(
    APIRoute.CodenamesEndTurn,
    () => {
      return handleCodenamesEndTurn();
    },
    {
      body: APIRouteToSchema[APIRoute.CodenamesEndTurn].req,
      response: APIRouteToSchema[APIRoute.CodenamesEndTurn].res,
    }
  );

// Add catch-all route last so API routes above are matched before frontend routes
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
