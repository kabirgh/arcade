import { type Static } from "elysia";

import type {
  ErrorPayload,
  SuccessResponse,
} from "../../../shared/types/api/common";
import { APIRoute, APIRouteToSchema } from "../../../shared/types/api/schema";

type ApiSchema = typeof APIRouteToSchema;

// Request Body Type: Extracts the static type from the request schema.
type RequestZodSchema<R extends APIRoute> = ApiSchema[R]["req"];
type RequestBody<R extends APIRoute> = Static<RequestZodSchema<R>>;

// Success Data Type: Extracts the 'data' part from a successful response envelope.
type ResponseZodSchema<R extends APIRoute> = ApiSchema[R]["res"];
type FullResponseType<R extends APIRoute> = Static<ResponseZodSchema<R>>;

type SuccessData<R extends APIRoute> = Extract<
  FullResponseType<R>,
  SuccessResponse<any>
> extends SuccessResponse<infer T>
  ? T
  : never;

export async function apiFetch<R extends APIRoute>(
  route: R,
  // Conditionally include 'body' argument only for non-GET requests.
  ...args: ApiSchema[R]["method"] extends "GET" ? [] : [body: RequestBody<R>]
): Promise<SuccessData<R>> {
  const schema = APIRouteToSchema[route];
  // Extract body from args if present (only for non-GET requests).
  const bodyArg = args.length > 0 ? (args[0] as RequestBody<R>) : undefined;

  const options: RequestInit = {
    method: schema.method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (schema.method !== "GET" && bodyArg !== undefined) {
    options.body = JSON.stringify(bodyArg);
  }

  try {
    const response = await fetch(route, options);
    const jsonResponse = await response.json();

    if (jsonResponse.ok === true) {
      // Type assertion is safe due to the 'ok' check and schema structure.
      return (jsonResponse as SuccessResponse<SuccessData<R>>).data;
    } else if (jsonResponse.ok === false) {
      const errorPayload = (jsonResponse as { ok: false; error: ErrorPayload })
        .error;
      throw new Error(
        `API Error: ${errorPayload.message} (Status: ${errorPayload.status})`
      );
    } else {
      throw new Error(
        `Invalid API response structure for route ${route}. Expected 'ok' property.`
      );
    }
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(`Request failed for route ${route}: ${String(e)}`);
  }
}
