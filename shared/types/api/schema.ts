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
  SessionIdRequestType,
  SessionIdResponseType,
  SetPlayerScreenRequestType,
  SetPlayerScreenResponseType,
} from "./misc";
import {
  AddTeamRequestType,
  AddTeamResponseType,
  DeleteTeamRequestType,
  DeleteTeamResponseType,
  KickPlayerRequestType,
  KickPlayerResponseType,
  ListPlayersRequestType,
  ListPlayersResponseType,
  ListTeamsRequestType,
  ListTeamsResponseType,
  SetTeamNameRequestType,
  SetTeamNameResponseType,
  UpdateTeamScoreRequestType,
  UpdateTeamScoreResponseType,
} from "./player";

export enum APIRoute {
  // Session
  SessionId = "/api/session/id",
  PlayerScreen = "/api/session/player-screen",
  SetPlayerScreen = "/api/session/set-player-screen",
  // Teams
  ListTeams = "/api/teams/list",
  SetTeamName = "/api/teams/set-name",
  UpdateTeamScore = "/api/teams/update-score",
  DeleteTeam = "/api/teams/delete",
  AddTeam = "/api/teams/add",
  // Players
  ListPlayers = "/api/players/list",
  KickPlayer = "/api/players/kick",
  // Websocket
  ListWebSocketClientIds = "/api/websocket/list-client-ids",
  SendWebSocketMessage = "/api/websocket/send-message",
  BroadcastAllPlayers = "/api/websocket/broadcast-all-players",
  // Codenames
  CodenamesState = "/api/codenames/state",
  CodenamesStart = "/api/codenames/start",
  CodenamesClue = "/api/codenames/clue",
  CodenamesGuess = "/api/codenames/guess",
  CodenamesEndTurn = "/api/codenames/end-turn",
}

// Schemas for each API route
export const APIRouteToSchema = {
  [APIRoute.SessionId]: {
    method: "GET",
    req: SessionIdRequestType,
    res: ResponseEnvelopeType(SessionIdResponseType),
  },
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
  [APIRoute.UpdateTeamScore]: {
    method: "POST",
    req: UpdateTeamScoreRequestType,
    res: ResponseEnvelopeType(UpdateTeamScoreResponseType),
  },
  [APIRoute.DeleteTeam]: {
    method: "POST",
    req: DeleteTeamRequestType,
    res: ResponseEnvelopeType(DeleteTeamResponseType),
  },
  [APIRoute.AddTeam]: {
    method: "POST",
    req: AddTeamRequestType,
    res: ResponseEnvelopeType(AddTeamResponseType),
  },
  [APIRoute.ListPlayers]: {
    method: "GET",
    req: ListPlayersRequestType,
    res: ResponseEnvelopeType(ListPlayersResponseType),
  },
  [APIRoute.KickPlayer]: {
    method: "POST",
    req: KickPlayerRequestType,
    res: ResponseEnvelopeType(KickPlayerResponseType),
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
