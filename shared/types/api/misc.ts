import { type Static, t } from "elysia";

import { PlayerScreenType } from "../domain/misc";

export const PlayerScreenRequestType = t.Object({});
export type PlayerScreenRequest = Static<typeof PlayerScreenRequestType>;

export const PlayerScreenResponseType = t.Object({
  screen: PlayerScreenType,
});
export type PlayerScreenResponse = Static<typeof PlayerScreenResponseType>;

export const SetPlayerScreenRequestType = t.Object({
  screen: PlayerScreenType,
});
export type SetPlayerScreenRequest = Static<typeof SetPlayerScreenRequestType>;

export const SetPlayerScreenResponseType = t.Object({});
export type SetPlayerScreenResponse = Static<
  typeof SetPlayerScreenResponseType
>;

export const BroadcastAllPlayersRequestType = t.Object({});
export type BroadcastAllPlayersRequest = Static<
  typeof BroadcastAllPlayersRequestType
>;

export const BroadcastAllPlayersResponseType = t.Object({});
export type BroadcastAllPlayersResponse = Static<
  typeof BroadcastAllPlayersResponseType
>;

export const SessionIdRequestType = t.Object({});
export type SessionIdRequest = Static<typeof SessionIdRequestType>;

export const SessionIdResponseType = t.Object({
  sessionId: t.String(),
  createdAt: t.Number(),
});
export type SessionIdResponse = Static<typeof SessionIdResponseType>;

export const StartNewSessionRequestType = t.Object({});
export type StartNewSessionRequest = Static<typeof StartNewSessionRequestType>;

export const StartNewSessionResponseType = t.Object({
  sessionId: t.String(),
  createdAt: t.Number(),
});
export type StartNewSessionResponse = Static<
  typeof StartNewSessionResponseType
>;
