import { type Static, t } from "elysia";

import { PlayerType, TeamType } from "../domain/player";

export const ListPlayersRequestType = t.Object({});
export type ListPlayersRequest = Static<typeof ListPlayersRequestType>;

export const ListPlayersResponseType = t.Object({
  players: t.Array(PlayerType),
});
export type ListPlayersResponse = Static<typeof ListPlayersResponseType>;

export const ListTeamsRequestType = t.Object({});
export type ListTeamsRequest = Static<typeof ListTeamsRequestType>;

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
