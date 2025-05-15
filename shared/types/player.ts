import { type Static, t } from "elysia";

export enum Color {
  Red = "#E8293C",
  Blue = "#5596E6",
  Green = "#00B4A0",
  Yellow = "#FDD600",
}

export enum Avatar {
  Icecream = "icecream",
  Bulb = "bulb",
  Asparagus = "asparagus",
  Barrel = "barrel",
  Book = "book",
  Bottle = "bottle",
  Cap = "cap",
  Carrot = "carrot",
  Apple = "apple",
  Chimney = "chimney",
  Cloud = "cloud",
  Hourglass = "hourglass",
  Kite = "kite",
  Mug = "mug",
  Candle = "candle",
  Stopwatch = "stopwatch",
  Puzzle = "puzzle",
  Rocket = "rocket",
  Pillow = "pillow",
  Spikyball = "spikyball",
  Palette = "palette",
  Tree = "tree",
  Umbrella = "umbrella",
  World = "world",
}

export const TeamType = t.Object({
  name: t.String(), // must be unique
  color: t.Enum(Color),
});
export type Team = Static<typeof TeamType>;

// Denormalized
export const PlayerType = t.Object({
  name: t.String(),
  team: TeamType, // If team is updated, player also needs to be updated
  avatar: t.Enum(Avatar),
});

export type Player = Static<typeof PlayerType>;
