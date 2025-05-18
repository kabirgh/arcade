import type { Static } from "@sinclair/typebox";

import { APIRoute, APIRouteToSchema } from "../../../shared/types/api/schema";

// Define a helper type to extract the request body type from the schema
// Uses Static to get the actual TypeScript type from the TypeBox schema
type RequestBodyType<Route extends APIRoute> = Static<
  (typeof APIRouteToSchema)[Route]["req"]
>;

// Define a helper type to extract the response body type from the schema
// Uses Static to get the actual TypeScript type from the TypeBox schema
type ResponseBodyType<Route extends APIRoute> = Static<
  (typeof APIRouteToSchema)[Route]["res"]
>;

// Conditional type for options: if req is EmptyRequestType, body is not allowed.
// Otherwise, body is required and must match the schema's request type.
type FetchApiOptions<Route extends APIRoute> =
  RequestBodyType<Route> extends Record<string, never> // Check if req is essentially EmptyRequestType after Static<> transformation
    ? { route: Route; body?: never }
    : { route: Route; body: RequestBodyType<Route> };

export async function fetchApi<Route extends APIRoute>(
  options: FetchApiOptions<Route>
): Promise<ResponseBodyType<Route>> {
  const { route, body } = options;
  const routeSchema = APIRouteToSchema[route];

  const fetchOptions: RequestInit = {
    method: routeSchema.method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body && routeSchema.method !== "GET") {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(route, fetchOptions);

  if (!response.ok) {
    let errorData: any = { message: "Unknown error during response parsing" };
    try {
      errorData = await response.json();
    } catch (e) {
      // If parsing errorData itself fails, retain the original status text or a generic message
      errorData = {
        message: response.statusText || "Failed to parse error response JSON",
      };
    }
    throw new Error(
      `API Error: ${response.status} ${response.statusText} - ${
        errorData.message || JSON.stringify(errorData)
      }`
    );
  }

  // Handle 204 No Content: The body will be empty.
  // The expected response type (ResponseBodyType<Route>) should accommodate this.
  if (response.status === 204) {
    return undefined as unknown as ResponseBodyType<Route>;
  }

  try {
    const responseData = await response.json();
    return responseData as ResponseBodyType<Route>;
  } catch (error) {
    // This catch block handles errors during response.json() parsing for non-204 successful responses.
    // This could happen if the server sends a 200 OK with an empty or malformed JSON body.
    console.error(
      "API Success (non-204), but failed to parse JSON response:",
      error,
      "Route:",
      route
    );

    // If parsing failed, but the status was OK, it implies an empty or non-JSON body.
    // Return undefined, cast appropriately. The caller must handle this based on the expected ResponseBodyType.
    return undefined as unknown as ResponseBodyType<Route>;
  }
}

// Example Usage (assuming you have these types defined elsewhere):
/*
import { SuccessResponseType } from "../../../shared/types/api/common";

// Example GET request (Teams returns SuccessResponseType)
fetchApi({ route: APIRoute.Teams })
  .then((data) => { // data is Static<typeof SuccessResponseType> or equivalent
    if (data && data.success) {
      console.log("Teams fetched successfully (generic success response)");
    } else {
      console.log("Teams fetch: response might be empty (e.g. from 204 or parse error on empty body)", data);
    }
  })
  .catch(console.error);

// Example POST request with a specific body and response type (CodenamesStart)
fetchApi({ route: APIRoute.CodenamesStart, body: { userId: "test-user" } })
  .then((data) => { // data is Static<typeof CodenamesStartResponseType>
    console.log("Codenames game started:", data.state); // Accessing data.state assumes it's part of the response type
  })
  .catch(console.error);

// Example POST request with EmptyRequestType (no body expected)
// APIRoute.SetPlayerScreen has req: EmptyRequestType, res: SuccessResponseType
fetchApi({ route: APIRoute.SetPlayerScreen })
 .then((data) => { // data is Static<typeof SuccessResponseType>
    if (data && data.success) {
      console.log("SetPlayerScreen successful.");
    } else { // Handle data being undefined
      console.log("SetPlayerScreen: operation successful, no content or undefined response.");
    }
 })
 .catch(console.error);

*/
