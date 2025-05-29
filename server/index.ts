import "dotenv/config";

import { html } from "@elysiajs/html";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import { ElysiaWS } from "elysia/dist/ws";
import path from "path";

import { APIRoute, APIRouteToSchema } from "../shared/types/api/schema";
import {
  type PlayerListAllMessage,
  type WebSocketMessage,
  WebSocketMessageType,
} from "../shared/types/api/websocket";
import { Channel, MessageType } from "../shared/types/domain/websocket";
import {
  handleCodenamesAskLlm,
  handleCodenamesClue,
  handleCodenamesEndTurn,
  handleCodenamesGuess,
  handleCodenamesStart,
  handleCodenamesState,
} from "./codenames";
import DB from "./db";

const db = new DB();

function sendHostMessage(message: WebSocketMessage): void {
  if (!db.hostWs) {
    console.error("No host ws found");
    return;
  }
  db.hostWs.send(JSON.stringify(message));
}

function broadcast(message: WebSocketMessage): void {
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
  switch (message.channel) {
    case Channel.ADMIN:
      console.log("Received admin message:", message);
      switch (message.messageType) {
        case MessageType.CLAIM_HOST:
          console.log("Claiming host:", ws.id);
          db.hostWs = ws;
          break;
        case MessageType.HOST_NAVIGATE:
          sendHostMessage(message);
          break;
        case MessageType.PLAYER_NAVIGATE:
          db.screen = message.payload.screen;
          broadcast(message);
          break;
      }
      break;

    case Channel.PLAYER:
      console.log("Received player message:", message);
      switch (message.messageType) {
        case MessageType.JOIN:
          if (db.kickedPlayerIds.has(message.payload.id)) {
            // Don't allow kicked players to join again
            // Emit a message to the client to clear localstorage so they stop
            // trying to reconnect
            ws.send(
              JSON.stringify({
                channel: Channel.PLAYER,
                messageType: MessageType.KICK,
                payload: {
                  playerId: message.payload.id,
                },
              })
            );
            return;
          }

          for (const [otherWs, player] of db.wsPlayerMap.entries()) {
            if (otherWs === ws) {
              continue;
            }
            if (player !== null && player.id === message.payload.id) {
              // We found a player with the same id in the list.
              // This means the websocket id has changed (usually due to a reconnect).
              // Remove the old player and add the new one
              db.wsPlayerMap.delete(otherWs);
              db.wsPlayerMap.set(ws, message.payload);
              // Don't need to broadcast player list because only the websocket
              // id changed, which the client doesn't need to know. Return early
              return;
            }
          }
          // Didn't find a player with the same id, so add this player to the list
          db.wsPlayerMap.set(ws, message.payload);
          break;

        case MessageType.LEAVE:
          db.wsPlayerMap.delete(ws);
          break;

        case MessageType.KICK:
          // Client message
          break;

        case MessageType.LIST:
          // Client message
          break;
      }
      // Broadcast the player list to all clients
      broadcastAllPlayers();
      break;

    case Channel.BUZZER:
      switch (message.messageType) {
        case MessageType.BUZZ:
          // Use server time to ensure consistent ordering of buzzes
          message.payload.timestamp = Date.now();
          sendHostMessage(message);
          break;

        case MessageType.RESET:
          sendHostMessage(message);
          break;
      }
      break;

    case Channel.JOYSTICK:
      switch (message.messageType) {
        case MessageType.MOVE:
          sendHostMessage(message);
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
      return { ok: true as const, data: { screen: db.screen } };
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
      return { ok: true as const, data: {} };
    },
    {
      body: APIRouteToSchema[APIRoute.SetPlayerScreen].req,
      response: APIRouteToSchema[APIRoute.SetPlayerScreen].res,
    }
  )
  .get(
    APIRoute.ListTeams,
    () => {
      return { ok: true as const, data: { teams: db.teams } };
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
        return {
          ok: false as const,
          error: {
            status: 404,
            message: "Team not found",
          },
        };
      }
      team.name = body.name;

      return { ok: true as const, data: {} };
    },
    {
      body: APIRouteToSchema[APIRoute.SetTeamName].req,
      response: APIRouteToSchema[APIRoute.SetTeamName].res,
    }
  )
  .get(
    APIRoute.ListPlayers,
    () => {
      return { ok: true as const, data: { players: db.players } };
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
      return {
        ok: true as const,
        data: { ids: [...db.wsPlayerMap.keys()].map((ws) => ws.id) },
      };
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
        return {
          ok: false as const,
          error: {
            status: 404,
            message: "Client not found",
          },
        };
      }
      handleWebSocketMessage(ws, body.message);
      return { ok: true as const, data: {} };
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
      return { ok: true as const, data: {} };
    },
    {
      body: APIRouteToSchema[APIRoute.BroadcastAllPlayers].req,
      response: APIRouteToSchema[APIRoute.BroadcastAllPlayers].res,
    }
  )
  .post(
    APIRoute.KickPlayer,
    ({ body }) => {
      for (const [ws, player] of db.wsPlayerMap.entries()) {
        if (player && player.name === body.playerName) {
          // Emit a message to the client to clear localstorage
          // and prevent the player from rejoining
          ws.send(
            JSON.stringify({
              channel: Channel.PLAYER,
              messageType: MessageType.KICK,
              payload: {
                playerId: player.id,
              },
            })
          );
          db.wsPlayerMap.delete(ws);
          db.kickedPlayerIds.add(player.id);
          broadcastAllPlayers();
          return { ok: true as const, data: { playerId: player.id } };
        }
      }
      return {
        ok: false as const,
        error: {
          status: 404,
          message: "Player not found",
        },
      };
    },
    {
      body: APIRouteToSchema[APIRoute.KickPlayer].req,
      response: APIRouteToSchema[APIRoute.KickPlayer].res,
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
    async ({ body }) => {
      return await handleCodenamesClue(body);
    },
    {
      body: APIRouteToSchema[APIRoute.CodenamesClue].req,
      response: APIRouteToSchema[APIRoute.CodenamesClue].res,
    }
  )
  .post(
    APIRoute.CodenamesGuess,
    async ({ body }) => {
      return await handleCodenamesGuess(body);
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
  )
  // Hard to typecheck since its an async generator
  .get("/api/codenames/ask-llm", async function* () {
    for await (const event of handleCodenamesAskLlm()) {
      yield JSON.stringify(event) + "\n";
    }
  });

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
