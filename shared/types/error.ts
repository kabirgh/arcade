import { t, type Static } from "elysia";

export const ErrorResponseType = t.Object({
  error: t.String(),
});
export type ErrorResponse = Static<typeof ErrorResponseType>;
