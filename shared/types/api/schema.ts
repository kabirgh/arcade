import {
  CodenamesClueRequestType,
  CodenamesClueResponseType,
  CodenamesEndTurnRequestType,
  CodenamesEndTurnResponseType,
  CodenamesGuessRequestType,
  CodenamesGuessResponseType,
  CodenamesStartRequestType,
  CodenamesStartResponseType,
} from "./codenames";
import { SendWebSocketMessageRequestType } from "../api/websocket";
import { EmptyRequestType, SuccessResponseType } from "./common";

export { EmptyRequestType } from "./common";

export enum APIRoute {
  PlayerScreen = "/api/player-screen",
  SetPlayerScreen = "/api/set-player-screen",
  Teams = "/api/teams",
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
// Requests do not include "body" since that is added by Elysia
export const APIRouteToSchema = {
  [APIRoute.PlayerScreen]: {
    method: "GET",
    req: EmptyRequestType,
    res: SuccessResponseType,
  },
  [APIRoute.SetPlayerScreen]: {
    method: "POST",
    req: EmptyRequestType,
    res: SuccessResponseType,
  },
  [APIRoute.Teams]: {
    method: "GET",
    req: EmptyRequestType,
    res: SuccessResponseType,
  },
  [APIRoute.Players]: {
    method: "GET",
    req: EmptyRequestType,
    res: SuccessResponseType,
  },
  [APIRoute.ListWebSocketClientIds]: {
    method: "GET",
    req: EmptyRequestType,
    res: SuccessResponseType,
  },
  [APIRoute.SendWebSocketMessage]: {
    method: "POST",
    req: SendWebSocketMessageRequestType,
    res: SuccessResponseType,
  },
  [APIRoute.BroadcastAllPlayers]: {
    method: "POST",
    req: EmptyRequestType,
    res: SuccessResponseType,
  },
  [APIRoute.CodenamesState]: {
    method: "POST",
    req: CodenamesClueRequestType,
    res: CodenamesClueResponseType,
  },
  [APIRoute.CodenamesStart]: {
    method: "POST",
    req: CodenamesStartRequestType,
    res: CodenamesStartResponseType,
  },
  [APIRoute.CodenamesClue]: {
    method: "POST",
    req: CodenamesClueRequestType,
    res: CodenamesClueResponseType,
  },
  [APIRoute.CodenamesGuess]: {
    method: "POST",
    req: CodenamesGuessRequestType,
    res: CodenamesGuessResponseType,
  },
  [APIRoute.CodenamesEndTurn]: {
    method: "POST",
    req: CodenamesEndTurnRequestType,
    res: CodenamesEndTurnResponseType,
  },
} as const;
