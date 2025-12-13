import "dotenv/config";

import { html } from "@elysiajs/html";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import { ElysiaWS } from "elysia/dist/ws";
import path from "path";

import config from "../config";
import { APIRoute, APIRouteToSchema } from "../shared/types/api/schema";
import {
  type PlayerListAllMessage,
  type WebSocketMessage,
  WebSocketMessageType,
} from "../shared/types/api/websocket";
import { Color } from "../shared/types/domain/player";
import { Channel, MessageType } from "../shared/types/domain/websocket";
import { generateId } from "../shared/utils";
import {
  handleCodenamesAskLlm,
  handleCodenamesClue,
  handleCodenamesEndTurn,
  handleCodenamesGuess,
  handleCodenamesStart,
  handleCodenamesState,
} from "./codenames";
import DB from "./db";
import { logError, logInfo, logWarn } from "./utils";

const db = new DB();

function sendHostMessage(message: WebSocketMessage): void {
  if (!db.hostWs) {
    logError("No host ws found");
    return;
  }
  db.hostWs.send(JSON.stringify(message));
}

function broadcast(message: WebSocketMessage): void {
  for (const { ws } of db.wsPlayerMap.values()) {
    ws.send(JSON.stringify(message));
  }
  db.hostWs?.send(JSON.stringify(message));
}

function broadcastAllPlayers(): PlayerListAllMessage {
  const message: PlayerListAllMessage = {
    channel: Channel.PLAYER,
    messageType: MessageType.LIST,
    payload: db.players,
  };
  logInfo(
    "Broadcasting player list",
    message.payload.map((p) => p.name)
  );
  broadcast(message);
  return message;
  console.log();
}

function kickPlayer(wsId: string): string {
  const entry = db.wsPlayerMap.get(wsId);

  if (!entry) {
    logError("No entry found for websocket ID:", wsId);
    return "";
  }
  if (!entry.ws) {
    logError("No websocket found for websocket ID:", wsId);
    return "";
  }
  // This can happen if the client is on the join screen and hasn't created a player yet
  if (!entry.player) {
    logWarn("No player found for websocket ID:", wsId);
    return "";
  }

  // Emit a message to the client to clear localstorage
  // and prevent the player from rejoining
  entry.ws.send(
    JSON.stringify({
      channel: Channel.PLAYER,
      messageType: MessageType.KICK,
      payload: {
        playerId: entry.player.id,
      },
    })
  );
  db.kickedPlayerIds.add(entry.player.id);
  db.wsPlayerMap.delete(wsId);

  return entry.player.id;
}

const handleWebSocketMessage = (ws: ElysiaWS, message: WebSocketMessage) => {
  switch (message.channel) {
    case Channel.ADMIN:
      switch (message.messageType) {
        case MessageType.CLAIM_HOST:
          logInfo("Claiming host:", ws.id);
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
      logInfo("Received player message:", message);
      switch (message.messageType) {
        case MessageType.JOIN: {
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

          // Check for existing player with same ID (reconnection handling)
          for (const [otherWsId, { player }] of db.wsPlayerMap.entries()) {
            if (otherWsId === ws.id) {
              continue;
            }
            if (player && player.id === message.payload.id) {
              // We found a player with the same id in the list.
              // This means the websocket id has changed (usually due to a reconnect).
              // Remove the old player and add the new one
              db.wsPlayerMap.delete(otherWsId);
              db.wsPlayerMap.set(ws.id, { ws, player: message.payload });
              // Don't need to broadcast player list because only the websocket
              // id changed, which the client doesn't need to know. Return early
              return;
            }
          }

          // Assume player has been validated

          // Add the player
          db.wsPlayerMap.set(ws.id, { ws, player: message.payload });
          break;
        }

        case MessageType.LEAVE: {
          const player = db.wsPlayerMap.get(ws.id)?.player;
          if (player && player.name !== message.payload.playerName) {
            logWarn(
              `Player name in message payload ${message.payload.playerName} does not match player name in websocket map ${player?.name}. Using player from websocket map`
            );
          }
          if (player) {
            db.wsPlayerMap.delete(ws.id);
            db.kickedPlayerIds.delete(player.id);
          }
          break;
        }

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

    case Channel.GAME:
      switch (message.messageType) {
        case MessageType.START_GAME:
        case MessageType.DUCK_SPAWN_INTERVAL:
        case MessageType.BOAT_ADD_TIME:
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
      logInfo("Client connected:", ws.id);
      db.wsPlayerMap.set(ws.id, { ws, player: null });
    },
    close(ws) {
      logInfo("Client disconnected:", ws.id);
      // Broadcast deletions after a while. This helps with:
      // 1. Player 1 joins, temporarily disconnects because their phone is off
      // 2. On the join screen, player 1's avatar should not be available unless they meant to disconnect
      // If we don't wait to remove the player, their avatar will be available for others to select
      setTimeout(() => {
        const removed = db.wsPlayerMap.delete(ws.id);
        if (removed) {
          broadcastAllPlayers();
        }
      }, 10000);
      // If the player reconnects within a few seconds, the JOIN handler will delete
      // the old ws id and add the new one, so it looks like they never left
    },
  })
  .get(
    APIRoute.SessionId,
    () => {
      const sessionData = db.getSession();
      if (!sessionData) {
        return {
          ok: false as const,
          error: {
            status: 500,
            message: "Session not found",
          },
        };
      }
      return {
        ok: true as const,
        data: sessionData,
      };
    },
    {
      body: APIRouteToSchema[APIRoute.SessionId].req,
      response: APIRouteToSchema[APIRoute.SessionId].res,
    }
  )
  .post(
    APIRoute.StartNewSession,
    () => {
      // First kick all players so they're redirected to the join screen
      for (const wsId of db.wsPlayerMap.keys()) {
        kickPlayer(wsId);
      }
      // Then start a new session (this clears the player map)
      const sessionData = db.startNewSession();

      broadcastAllPlayers();

      return {
        ok: true as const,
        data: sessionData,
      };
    },
    {
      body: APIRouteToSchema[APIRoute.StartNewSession].req,
      response: APIRouteToSchema[APIRoute.StartNewSession].res,
    }
  )
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
      const team = db.getTeamById(body.teamId);
      if (!team) {
        return {
          ok: false as const,
          error: {
            status: 404,
            message: "Team not found",
          },
        };
      }
      db.updateTeamName(body.teamId, body.name);

      return { ok: true as const, data: {} };
    },
    {
      body: APIRouteToSchema[APIRoute.SetTeamName].req,
      response: APIRouteToSchema[APIRoute.SetTeamName].res,
    }
  )
  .post(
    APIRoute.UpdateTeamScore,
    ({ body }) => {
      const team = db.getTeamById(body.teamId);
      if (!team) {
        return {
          ok: false as const,
          error: {
            status: 404,
            message: "Team not found",
          },
        };
      }
      const newScore = Math.max(0, team.score + body.scoreChange); // Ensure score doesn't go below 0
      db.updateTeamScore(body.teamId, newScore);

      return { ok: true as const, data: { newScore } };
    },
    {
      body: APIRouteToSchema[APIRoute.UpdateTeamScore].req,
      response: APIRouteToSchema[APIRoute.UpdateTeamScore].res,
    }
  )
  .post(
    APIRoute.DeleteTeam,
    ({ body }) => {
      const team = db.getTeamById(body.teamId);
      if (!team) {
        return {
          ok: false as const,
          error: {
            status: 404,
            message: "Team not found",
          },
        };
      }

      // Delete team from database
      db.deleteTeam(body.teamId);

      // Move all players from this team back to no team (empty teamId)
      db.players.forEach((player) => {
        if (player.teamId === body.teamId) {
          player.teamId = "";
        }
      });

      // Broadcast updated player list
      broadcastAllPlayers();

      return { ok: true as const, data: {} };
    },
    {
      body: APIRouteToSchema[APIRoute.DeleteTeam].req,
      response: APIRouteToSchema[APIRoute.DeleteTeam].res,
    }
  )
  .post(
    APIRoute.AddTeam,
    () => {
      const existingTeams = db.teams;

      if (existingTeams.length >= 4) {
        return {
          ok: false as const,
          error: {
            status: 400,
            message: "Maximum of 4 teams allowed",
          },
        };
      }

      // Generate team ID based on existing teams
      const teamId = generateId("team", 6);

      // Colors in order: red, blue, green, yellow
      const colors = [Color.Red, Color.Blue, Color.Green, Color.Yellow];
      let teamColor = colors[0];
      for (const color of colors) {
        if (!db.teams.some((team) => team.color === color)) {
          teamColor = color;
          break;
        }
      }

      const newTeam = {
        id: teamId,
        name: `Team ${teamId.slice(6, 9)}`,
        color: teamColor,
        score: 0,
      };

      // Add team to database
      db.addTeam(newTeam);

      return { ok: true as const, data: { team: newTeam } };
    },
    {
      body: APIRouteToSchema[APIRoute.AddTeam].req,
      response: APIRouteToSchema[APIRoute.AddTeam].res,
    }
  )
  .post(
    APIRoute.ValidatePlayerJoin,
    ({ body }) => {
      const existingPlayerWithName = db.players.find(
        (player) => player.name === body.name
      );
      if (existingPlayerWithName) {
        return {
          ok: true as const,
          data: {
            valid: false,
            errorMessage: "This name has been taken by another player",
          },
        };
      }
      const existingPlayerWithAvatar = db.players.find(
        (player) => player.avatar === body.avatar
      );
      if (existingPlayerWithAvatar) {
        return {
          ok: true as const,
          data: {
            valid: false,
            errorMessage: "This avatar has been taken by another player",
          },
        };
      }
      return {
        ok: true as const,
        data: { valid: true, errorMessage: "" },
      };
    },
    {
      body: APIRouteToSchema[APIRoute.ValidatePlayerJoin].req,
      response: APIRouteToSchema[APIRoute.ValidatePlayerJoin].res,
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
        data: { ids: [...db.wsPlayerMap.keys()] },
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
      const ws = body.id === "" ? db.hostWs : db.wsPlayerMap.get(body.id)?.ws;

      if (!ws) {
        return {
          ok: false as const,
          error: {
            status: 404,
            message: `WebSocket ${body.id} not found`,
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
      for (const [wsId, { player }] of db.wsPlayerMap.entries()) {
        if (
          player &&
          player.name.toUpperCase() === body.playerName.toUpperCase()
        ) {
          kickPlayer(wsId);
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
        assets: process.platform === "win32" ? "client\\dist" : "client/dist", // Do not change: must be escaped backslash to work on Windows
        prefix: "/",
      })
    )
    // This catch-all route serves the SPA's index.html for any non-API, non-static-file requests.
    .get("*", ({ html }) => html(indexHTML));
}

// Configure server based on hosting mode
if (config.mode === "internet") {
  // Internet mode: HTTPS with TLS
  const tlsConfig = config.internet.tls;

  app.listen({
    hostname: "0.0.0.0",
    port: config.internet.port,
    tls: {
      key: Bun.file(tlsConfig.keyPath),
      cert: Bun.file(tlsConfig.certPath),
    },
  });

  logInfo(
    `🦊 Elysia is running at https://${config.internet.domain}:${config.internet.port}`
  );
  logInfo(
    `🛠️ The admin page is available at https://${config.internet.domain}:${config.internet.port}/admin`
  );
} else {
  // Local mode: HTTP only
  app.listen({
    hostname: "0.0.0.0",
    port: config.server.port,
  });

  logInfo(
    `🦊 Elysia is running at http://${config.server.host}:${config.server.port}`
  );
  logInfo(
    `🛠️ The admin page is available at http://${config.server.host}:${config.server.port}/admin`
  );
}
