import { type Static, t } from "elysia";

import { GameStateType } from "../domain/codenames";
import { ErrorResponseType } from "./common";

// Request and response types for the Codenames API
// State
export const CodenamesStateResponseType = t.Object({
  state: GameStateType,
});
export type CodenamesStateResponse = Static<typeof CodenamesStateResponseType>;

// Start
export const CodenamesStartRequestType = t.Object({});
export type CodenamesStartRequest = Static<typeof CodenamesStartRequestType>;

export const CodenamesStartResponseType = t.Object({
  state: GameStateType,
});
export type CodenamesStartResponse = Static<typeof CodenamesStartResponseType>;

// Clue
export const CodenamesClueRequestType = t.Object({
  clueWord: t.String(),
  clueNumber: t.Number(),
});
export type CodenamesClueRequest = Static<typeof CodenamesClueRequestType>;

export const CodenamesClueResponseType = t.Union([
  t.Object({ state: GameStateType }),
  ErrorResponseType,
]);
export type CodenamesClueResponse = Static<typeof CodenamesClueResponseType>;

// Guess
export const CodenamesGuessRequestType = t.Object({
  word: t.String(),
});
export type CodenamesGuessRequest = Static<typeof CodenamesGuessRequestType>;

export const CodenamesGuessResponseType = t.Union([
  t.Object({ state: GameStateType }),
  ErrorResponseType,
]);
export type CodenamesGuessResponse = Static<typeof CodenamesGuessResponseType>;

// End turn
export const CodenamesEndTurnRequestType = t.Object({});
export type CodenamesEndTurnRequest = Static<
  typeof CodenamesEndTurnRequestType
>;

export const CodenamesEndTurnResponseType = t.Union([
  t.Object({ state: GameStateType }),
  ErrorResponseType,
]);
export type CodenamesEndTurnResponse = Static<
  typeof CodenamesEndTurnResponseType
>;
