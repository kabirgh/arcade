import { type Static, t } from "elysia";

import { Nullable } from "../core";

// Types for the engine
export const CodenamesTeamType = t.Union([t.Literal("red"), t.Literal("blue")]);
export type CodenamesTeam = Static<typeof CodenamesTeamType>;

export const PhaseType = t.Union([
  t.Literal("CLUE"),
  t.Literal("GUESS"),
  t.Literal("GAME_OVER"),
]);
export type Phase = Static<typeof PhaseType>;

export const RoleType = t.Union([
  t.Literal("system"),
  t.Literal("user"),
  t.Literal("assistant"),
]);
export type Role = Static<typeof RoleType>;

export enum CardClass {
  Red = "red",
  Blue = "blue",
  Neutral = "neutral",
  Assassin = "assassin",
}
export const CardClassType = t.Enum(CardClass);

export const CardType = t.Object({
  word: t.String(),
  class: CardClassType,
  isRevealed: t.Boolean(),
});
export type Card = Static<typeof CardType>;

export const ClueType = t.Object({
  word: t.String(),
  number: t.Number(),
});
export type Clue = Static<typeof ClueType>;

export const GameStateType = t.Object({
  board: t.Array(CardType),
  turn: CodenamesTeamType,
  phase: PhaseType,
  clue: Nullable(ClueType),
  remainingGuesses: t.Number(),
  score: t.Object({
    red: t.Number(),
    blue: t.Number(),
  }),
  history: t.Array(
    t.Object({
      team: CodenamesTeamType,
      phase: PhaseType,
      message: t.String(),
    })
  ),
});
export type GameState = Static<typeof GameStateType>;
