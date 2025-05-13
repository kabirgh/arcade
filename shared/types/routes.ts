import {
  CodenamesClueRequestType,
  CodenamesGuessRequestType,
} from "./codenames";
import { WebSocketMessageType } from "./websocket";

export enum APIRoute {
  Screen = "/api/screen",
  Players = "/api/players",
  Broadcast = "/api/broadcast",
  CodenamesState = "/api/codenames/state",
  CodenamesStart = "/api/codenames/start",
  CodenamesClue = "/api/codenames/clue",
  CodenamesGuess = "/api/codenames/guess",
  CodenamesEndTurn = "/api/codenames/end-turn",
}

// Schemas for each API route
export const APIRouteSchemas = {
  [APIRoute.Screen]: null,
  [APIRoute.Players]: null,
  [APIRoute.Broadcast]: { body: WebSocketMessageType },
  [APIRoute.CodenamesState]: null,
  [APIRoute.CodenamesStart]: null,
  [APIRoute.CodenamesClue]: { body: CodenamesClueRequestType },
  [APIRoute.CodenamesGuess]: { body: CodenamesGuessRequestType },
  [APIRoute.CodenamesEndTurn]: null,
} as const;
