import { type Static, t } from "elysia";

export enum Color {
  Red = "#E8293C",
  Blue = "#5596E6",
  Green = "#00B4A0",
  Yellow = "#FFAE42",
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
  id: t.String(),
  name: t.String(),
  color: t.Enum(Color),
  score: t.Number(),
});
export type Team = Static<typeof TeamType>;

export const PlayerType = t.Object({
  id: t.String(),
  name: t.String(),
  avatar: t.Enum(Avatar),
  teamId: t.String(),
});
export type Player = Static<typeof PlayerType>;
