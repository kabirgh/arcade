import {
  ListWebSocketClientIdsRequestType,
  ListWebSocketClientIdsResponseType,
  SendWebSocketMessageRequestType,
  SendWebSocketMessageResponseType,
} from "../api/websocket";
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
import { EmptyRequestType, SuccessResponseType } from "./common";
import { PlayerScreenResponseType, SetPlayerScreenRequestType } from "./misc";
import {
  ListPlayersRequestType,
  ListPlayersResponseType,
  ListTeamsRequestType,
  ListTeamsResponseType,
  SetTeamNameRequestType,
  SetTeamNameResponseType,
} from "./player";

export enum APIRoute {
  PlayerScreen = "/api/player-screen",
  SetPlayerScreen = "/api/set-player-screen",
  ListTeams = "/api/teams",
  SetTeamName = "/api/set-team-name",
  ListPlayers = "/api/players",
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
    res: PlayerScreenResponseType,
  },
  [APIRoute.SetPlayerScreen]: {
    method: "POST",
    req: SetPlayerScreenRequestType,
    res: SuccessResponseType,
  },
  [APIRoute.ListTeams]: {
    method: "GET",
    req: ListTeamsRequestType,
    res: ListTeamsResponseType,
  },
  [APIRoute.SetTeamName]: {
    method: "POST",
    req: SetTeamNameRequestType,
    res: SetTeamNameResponseType,
  },
  [APIRoute.ListPlayers]: {
    method: "GET",
    req: ListPlayersRequestType,
    res: ListPlayersResponseType,
  },
  [APIRoute.ListWebSocketClientIds]: {
    method: "GET",
    req: ListWebSocketClientIdsRequestType,
    res: ListWebSocketClientIdsResponseType,
  },
  [APIRoute.SendWebSocketMessage]: {
    method: "POST",
    req: SendWebSocketMessageRequestType,
    res: SendWebSocketMessageResponseType,
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
