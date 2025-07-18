import { type Static, t } from "elysia";

import { PlayerType, TeamType } from "../domain/player";

export const ValidatePlayerJoinRequestType = t.Object({
  name: t.String(),
  avatar: t.String(),
});
export type ValidatePlayerJoinRequest = Static<
  typeof ValidatePlayerJoinRequestType
>;

export const ValidatePlayerJoinResponseType = t.Object({
  valid: t.Boolean(),
  errorMessage: t.Union([
    t.Literal("This name has been taken by another player"),
    t.Literal("This avatar has been taken by another player"),
    t.Literal(""),
  ]),
});
export type ValidatePlayerJoinResponse = Static<
  typeof ValidatePlayerJoinResponseType
>;

export const ListPlayersRequestType = t.Object({});
export type ListPlayersRequest = Static<typeof ListPlayersRequestType>;

export const ListPlayersResponseType = t.Object({
  players: t.Array(PlayerType),
});
export type ListPlayersResponse = Static<typeof ListPlayersResponseType>;

export const ListTeamsRequestType = t.Object({});
export type ListTeamsRequest = Static<typeof ListTeamsRequestType>;

export const KickPlayerRequestType = t.Object({
  playerName: t.String(),
});
export type KickPlayerRequest = Static<typeof KickPlayerRequestType>;

export const KickPlayerResponseType = t.Object({
  playerId: t.String(),
});
export type KickPlayerResponse = Static<typeof KickPlayerResponseType>;

export const ListTeamsResponseType = t.Object({
  teams: t.Array(TeamType),
});
export type ListTeamsResponse = Static<typeof ListTeamsResponseType>;

export const SetTeamNameRequestType = t.Object({
  teamId: t.String(),
  name: t.String(),
});
export type SetTeamNameRequest = Static<typeof SetTeamNameRequestType>;

export const SetTeamNameResponseType = t.Object({});
export type SetTeamNameResponse = Static<typeof SetTeamNameResponseType>;

export const UpdateTeamScoreRequestType = t.Object({
  teamId: t.String(),
  scoreChange: t.Integer(), // positive to add, negative to subtract
});
export type UpdateTeamScoreRequest = Static<typeof UpdateTeamScoreRequestType>;

export const UpdateTeamScoreResponseType = t.Object({
  newScore: t.Number(),
});
export type UpdateTeamScoreResponse = Static<
  typeof UpdateTeamScoreResponseType
>;

export const DeleteTeamRequestType = t.Object({
  teamId: t.String(),
});
export type DeleteTeamRequest = Static<typeof DeleteTeamRequestType>;

export const DeleteTeamResponseType = t.Object({});
export type DeleteTeamResponse = Static<typeof DeleteTeamResponseType>;

export const AddTeamRequestType = t.Object({});
export type AddTeamRequest = Static<typeof AddTeamRequestType>;

export const AddTeamResponseType = t.Object({
  team: TeamType,
});
export type AddTeamResponse = Static<typeof AddTeamResponseType>;
