import { type Static, t } from "elysia";
import { Nullable } from "../core";

// Types for the engine
export const CodenamesTeamType = t.Union([t.Literal("red"), t.Literal("blue")]);
export type CodenamesTeam = Static<typeof CodenamesTeamType>;

export const PhaseType = t.Union([t.Literal("CLUE"), t.Literal("GUESS")]);
export type Phase = Static<typeof PhaseType>;

export const RoleType = t.Union([
  t.Literal("system"),
  t.Literal("user"),
  t.Literal("assistant"),
]);
export type Role = Static<typeof RoleType>;

export enum CardClass {
  Red,
  Blue,
  Neutral,
  Assassin,
}
export const CardClassType = t.Enum(CardClass);

export const CardType = t.Object({
  word: t.String(),
  class: CardClassType,
  isRevealed: t.Boolean(),
});
export type Card = Static<typeof CardType>;

export const GameStateType = t.Object({
  board: t.Array(CardType),
  turn: CodenamesTeamType,
  phase: PhaseType,
  clue: Nullable(t.Object({ word: t.String(), number: t.Number() })),
  remainingGuesses: t.Number(),
  score: t.Object({
    red: t.Number(),
    blue: t.Number(),
  }),
  chat: t.Object({
    red: t.Array(t.Object({ role: RoleType, content: t.String() })),
    blue: t.Array(t.Object({ role: RoleType, content: t.String() })),
  }),
});
export type GameState = Static<typeof GameStateType>;
