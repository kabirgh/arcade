import { type Static, t } from "elysia";

export const EmptyRequestType = t.Object({});
export type EmptyRequest = Static<typeof EmptyRequestType>;

export const SuccessResponseType = t.Object({
  success: t.Boolean(),
});
export type SuccessResponse = Static<typeof SuccessResponseType>;

export const ErrorResponseType = t.Object({
  error: t.String(),
});
export type ErrorResponse = Static<typeof ErrorResponseType>;
