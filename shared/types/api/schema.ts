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
  CodenamesStateRequestType,
  CodenamesStateResponseType,
} from "./codenames";
import { ResponseEnvelopeType } from "./common";
import {
  BroadcastAllPlayersRequestType,
  BroadcastAllPlayersResponseType,
  PlayerScreenRequestType,
  PlayerScreenResponseType,
  SetPlayerScreenRequestType,
  SetPlayerScreenResponseType,
} from "./misc";
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
export const APIRouteToSchema = {
  [APIRoute.PlayerScreen]: {
    method: "GET",
    req: PlayerScreenRequestType,
    res: ResponseEnvelopeType(PlayerScreenResponseType),
  },
  [APIRoute.SetPlayerScreen]: {
    method: "POST",
    req: SetPlayerScreenRequestType,
    res: ResponseEnvelopeType(SetPlayerScreenResponseType),
  },
  [APIRoute.ListTeams]: {
    method: "GET",
    req: ListTeamsRequestType,
    res: ResponseEnvelopeType(ListTeamsResponseType),
  },
  [APIRoute.SetTeamName]: {
    method: "POST",
    req: SetTeamNameRequestType,
    res: ResponseEnvelopeType(SetTeamNameResponseType),
  },
  [APIRoute.ListPlayers]: {
    method: "GET",
    req: ListPlayersRequestType,
    res: ResponseEnvelopeType(ListPlayersResponseType),
  },
  [APIRoute.ListWebSocketClientIds]: {
    method: "GET",
    req: ListWebSocketClientIdsRequestType,
    res: ResponseEnvelopeType(ListWebSocketClientIdsResponseType),
  },
  [APIRoute.SendWebSocketMessage]: {
    method: "POST",
    req: SendWebSocketMessageRequestType,
    res: ResponseEnvelopeType(SendWebSocketMessageResponseType),
  },
  [APIRoute.BroadcastAllPlayers]: {
    method: "POST",
    req: BroadcastAllPlayersRequestType,
    res: ResponseEnvelopeType(BroadcastAllPlayersResponseType),
  },
  [APIRoute.CodenamesState]: {
    method: "GET",
    req: CodenamesStateRequestType,
    res: ResponseEnvelopeType(CodenamesStateResponseType),
  },
  [APIRoute.CodenamesStart]: {
    method: "POST",
    req: CodenamesStartRequestType,
    res: ResponseEnvelopeType(CodenamesStartResponseType),
  },
  [APIRoute.CodenamesClue]: {
    method: "POST",
    req: CodenamesClueRequestType,
    res: ResponseEnvelopeType(CodenamesClueResponseType),
  },
  [APIRoute.CodenamesGuess]: {
    method: "POST",
    req: CodenamesGuessRequestType,
    res: ResponseEnvelopeType(CodenamesGuessResponseType),
  },
  [APIRoute.CodenamesEndTurn]: {
    method: "POST",
    req: CodenamesEndTurnRequestType,
    res: ResponseEnvelopeType(CodenamesEndTurnResponseType),
  },
} as const;
