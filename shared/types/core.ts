import type { TSchema } from "elysia";
import { t } from "elysia";

export const Nullable = <T extends TSchema>(T: T) => {
  return t.Union([T, t.Null()]);
};
