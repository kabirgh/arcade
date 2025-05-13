import type { Static } from "elysia";
import { t } from "elysia";
import {
  CodenamesClueRequestType,
  CodenamesEndTurnRequestType,
  CodenamesGuessRequestType,
  CodenamesStartRequestType,
} from "./codenames";
import { SendWebSocketMessageRequestType } from "./websocket";

export const EmptyRequestType = t.Object({});
export type EmptyRequest = Static<typeof EmptyRequestType>;

export enum APIRoute {
  Screen = "/api/screen",
  Players = "/api/players",
  ListWebSocketClientIds = "/api/list-websocket-client-ids",
  SendWebSocketMessage = "/api/send-websocket-message",
  BroadcastAllPlayers = "/api/broadcast-all-players",
  CodenamesState = "/api/codenames/state",
  CodenamesStart = "/api/codenames/start",
  CodenamesClue = "/api/codenames/clue",
  CodenamesGuess = "/api/codenames/guess",
  CodenamesEndTurn = "/api/codenames/end-turn",
}

// Schemas for each API route
// Does not include "body" since that is added by Elysia
export const APIRouteToRequestSchema = {
  [APIRoute.Screen]: EmptyRequestType,
  [APIRoute.Players]: EmptyRequestType,
  [APIRoute.ListWebSocketClientIds]: EmptyRequestType,
  [APIRoute.SendWebSocketMessage]: SendWebSocketMessageRequestType,
  [APIRoute.BroadcastAllPlayers]: EmptyRequestType,
  [APIRoute.CodenamesState]: CodenamesClueRequestType,
  [APIRoute.CodenamesStart]: CodenamesStartRequestType,
  [APIRoute.CodenamesClue]: CodenamesClueRequestType,
  [APIRoute.CodenamesGuess]: CodenamesGuessRequestType,
  [APIRoute.CodenamesEndTurn]: CodenamesEndTurnRequestType,
} as const;
