import { type Static, t, type TSchema } from "elysia";

export const ErrorPayloadType = t.Object({
  status: t.Integer({ minimum: 400, maximum: 599 }),
  message: t.String(),
});
export type ErrorPayload = Static<typeof ErrorPayloadType>;

export const SuccessResponseType = <S extends TSchema>(dataSchema: S) =>
  t.Object({
    ok: t.Literal(true),
    data: dataSchema,
  });
export type SuccessResponse<T> = { ok: true; data: T };

export const ErrorResponseType = t.Object({
  ok: t.Literal(false),
  error: ErrorPayloadType,
});
export type ErrorResponse = Static<typeof ErrorResponseType>;

// helper that returns  { ok:true, data:… } | { ok:false, error:… }
export const ResponseEnvelopeType = <S extends TSchema>(dataSchema: S) =>
  t.Union([SuccessResponseType(dataSchema), ErrorResponseType]);
export type ResponseEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorPayload };

export type ApiResponse<T extends TSchema> = ResponseEnvelope<T>;
