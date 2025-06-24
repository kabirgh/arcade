import Alea from "alea";

import { Avatar } from "./types/domain/player";

export const createPrng = (seed: number): (() => number) => {
  return Alea(seed);
};

export const shuffle = <T>(array: T[], prng?: () => number): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(prng?.() ?? Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const avatarToPath = (avatar: Avatar) => {
  return `/avatars/${avatar}.png`;
};

export const generateId = (prefix: string, length: number) => {
  const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return `${prefix}_${result}`;
};
