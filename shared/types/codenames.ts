export type Team = "red" | "blue";

export enum CardType {
  Red,
  Blue,
  Neutral,
  Assassin,
}

export type Card = {
  word: string;
  type: CardType;
  isRevealed: boolean;
};

export type GameState = {
  board: Card[];
  turn: Team;
  phase: "CLUE" | "GUESS";
  clue: { word: string; number: number } | null;
  remainingGuesses: number;
  score: Record<Team, number>;
  chat: {
    [T in Team]: { role: "system" | "user" | "assistant"; content: string }[];
  };
};
