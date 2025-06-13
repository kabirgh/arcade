import { Value } from "@sinclair/typebox/value";
import React, { useEffect, useMemo, useState } from "react";

import { APIRoute, APIRouteToSchema } from "../../shared/types/api/schema";
import { WebSocketMessageType } from "../../shared/types/api/websocket";
import { HostScreen, PlayerScreen } from "../../shared/types/domain/misc";
import type { Team } from "../../shared/types/domain/player";
import { Channel, MessageType } from "../../shared/types/domain/websocket";
import PastelBackground from "./components/PastelBackground";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { useAdminAuth } from "./hooks/useAdminAuth";
import { apiFetch } from "./util/apiFetch";

// Function to generate schema templates dynamically based on route
const generateSchemaTemplate = (route: string): any => {
  const routeSchema = APIRouteToSchema[route as APIRoute];
  if (!routeSchema) return null; // Should not happen if route is a valid APIRoute

  const requestSchema = routeSchema.req;

  if (requestSchema) {
    // For union types like WebSocketMessageType, Value.Create might pick the first type.
    // This is generally fine for initial display if a specific sub-type isn't yet chosen.
    return Value.Create(requestSchema);
  }
  // Return null if no requestSchema is defined (e.g. for GET requests or routes with no body)
  return null;
};

// Generate templates for different message types dynamically
const getBroadcastTemplates = (): Record<string, any> => {
  const templates: Record<string, any> = {};

  // WebSocketMessageType is a t.Union. We iterate over its constituent schemas.
  // Each schema in 'anyOf' is an individual message type like PlayerJoinMessage, BuzzerPressMessage, etc.
  if (WebSocketMessageType && WebSocketMessageType.anyOf) {
    WebSocketMessageType.anyOf.forEach((messageSchema: any) => {
      // Ensure properties exist and are literals with a 'const' value
      if (
        messageSchema.properties &&
        messageSchema.properties.channel &&
        typeof messageSchema.properties.channel.const !== "undefined" &&
        messageSchema.properties.messageType &&
        typeof messageSchema.properties.messageType.const !== "undefined"
      ) {
        const channel = messageSchema.properties.channel.const;
        const messageType = messageSchema.properties.messageType.const;
        const key = `${channel}/${messageType}`;

        const messageContent: {
          channel: string;
          messageType: string;
          payload?: any;
        } = {
          channel,
          messageType,
        };

        if (messageSchema.properties.payload) {
          messageContent.payload = Value.Create(
            messageSchema.properties.payload
          );
        }

        // Wrap the messageContent in the SendWebSocketMessageRequestType structure
        const template = {
          id: "", // Default ID, can be configured as needed
          message: messageContent,
        };

        templates[key] = template;
      }
    });
  }
  return templates;
};

const Button = ({
  color,
  onClick,
  text,
}: {
  color: string;
  onClick: () => void;
  text: string;
}) => {
  return (
    <button
      className={`bg-${color}-700 text-white p-2 w-32 rounded-md cursor-pointer hover:bg-${color}-600 active:bg-${color}-800`}
      onClick={onClick}
    >
      {text}
    </button>
  );
};

const AdminPage: React.FC = () => {
  const { publish } = useWebSocketContext();
  const [selectedAPI, setSelectedAPI] = useState<string>(
    Object.values(APIRoute)[0] // Default to the first API route
  );
  const [jsonInput, setJsonInput] = useState<string>("");
  const [logs, setLogs] = useState<
    Array<{ request: any; response: any; timestamp: number }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [httpMethod, setHttpMethod] = useState<"GET" | "POST">(
    APIRouteToSchema[Object.values(APIRoute)[0] as APIRoute].method as
      | "GET"
      | "POST"
  );
  const [selectedMessageType, setSelectedMessageType] =
    useState<string>("PLAYER/JOIN");
  const broadcastTemplates = useMemo(() => getBroadcastTemplates(), []);
  const { isAuthenticated, passwordPrompt } = useAdminAuth();
  const [teams, setTeams] = useState<Team[]>([]);

  // Fetch teams on component mount
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await apiFetch(APIRoute.ListTeams);
        setTeams(response.teams);
      } catch (error) {
        console.error("Failed to fetch teams:", error);
      }
    };

    if (isAuthenticated) {
      fetchTeams();
    }
  }, [isAuthenticated]);

  // Prefill JSON schema when API endpoint or method changes
  useEffect(() => {
    const routeSchema = APIRouteToSchema[selectedAPI as APIRoute];
    if (routeSchema) {
      const method = routeSchema.method as "GET" | "POST";
      setHttpMethod(method);

      if (method === "POST") {
        if (
          selectedAPI === APIRoute.SendWebSocketMessage &&
          selectedMessageType
        ) {
          // Use selected message type template for broadcast
          const template = broadcastTemplates[selectedMessageType];
          if (template) {
            setJsonInput(JSON.stringify(template, null, 2));
          }
        } else {
          // Use standard template for other endpoints
          const template = generateSchemaTemplate(selectedAPI);
          if (template) {
            setJsonInput(JSON.stringify(template, null, 2));
          } else {
            setJsonInput("");
          }
        }
      } else {
        setJsonInput(""); // Clear JSON input for GET requests
      }
    } else {
      setJsonInput(""); // Clear JSON input if route schema not found
    }
  }, [selectedAPI, selectedMessageType, broadcastTemplates]);

  // Effect to manage selectedMessageType based on selectedAPI and available templates
  useEffect(() => {
    if (selectedAPI === APIRoute.SendWebSocketMessage) {
      // If the current selectedAPI is SendWebSocketMessage:
      // Check if the selectedMessageType is valid (i.e., exists as a key in broadcastTemplates).
      // A non-empty selectedMessageType that is not a key in broadcastTemplates is considered invalid.
      // An empty selectedMessageType is also considered invalid for defaulting.
      if (!selectedMessageType || !broadcastTemplates[selectedMessageType]) {
        const availableMessageTypes = Object.keys(broadcastTemplates);
        if (availableMessageTypes.length > 0) {
          // Set to the first available message type if current is invalid or empty
          setSelectedMessageType(availableMessageTypes[0]);
        } else {
          // No broadcast types available, so clear selectedMessageType
          setSelectedMessageType("");
        }
      }
      // If selectedMessageType was already valid (e.g., initially "PLAYER/JOIN" and it's in broadcastTemplates),
      // the condition (!selectedMessageType || !broadcastTemplates[selectedMessageType]) is false,
      // so the existing valid selectedMessageType is preserved.
    } else {
      // If the current selectedAPI is NOT SendWebSocketMessage, clear selectedMessageType.
      setSelectedMessageType("");
    }
  }, [selectedAPI, broadcastTemplates, selectedMessageType]);

  const handleResetBuzzers = () => {
    publish({
      channel: Channel.BUZZER,
      messageType: MessageType.RESET,
    });
  };

  const handleNavigateHostScreen = (hostScreen: HostScreen) => {
    publish({
      channel: Channel.ADMIN,
      messageType: MessageType.HOST_NAVIGATE,
      payload: {
        screen: hostScreen,
      },
    });
  };

  const handleNavigatePlayerScreen = (playerScreen: PlayerScreen) => {
    publish({
      channel: Channel.ADMIN,
      messageType: MessageType.PLAYER_NAVIGATE,
      payload: {
        screen: playerScreen,
      },
    });
  };

  const handleAPIChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAPI(e.target.value);
  };

  const handleMessageTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMessageType(e.target.value);
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAPI) {
      alert("Select an API endpoint");
      return;
    }

    let parsedJson = {};

    if (jsonInput.trim()) {
      try {
        parsedJson = JSON.parse(jsonInput);
      } catch (error) {
        alert(`Invalid JSON input: ${error}`);
        return;
      }
    }

    const requestLog = {
      method: httpMethod,
      endpoint: selectedAPI,
      body: parsedJson,
    };

    setIsLoading(true);

    try {
      const response = await fetch(selectedAPI, {
        method: httpMethod,
        headers: {
          "Content-Type": "application/json",
        },
        body: httpMethod === "POST" && jsonInput.trim() ? jsonInput : undefined,
      });

      const responseData =
        response.status !== 204 ? await response.json() : null;

      setLogs((prev) => [
        {
          request: requestLog,
          response: {
            status: response.status,
            data: responseData,
          },
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    } catch (error) {
      setLogs((prev) => [
        {
          request: requestLog,
          response: { error: String(error) },
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTeamScore = async (teamId: string, scoreChange: number) => {
    try {
      const response = await apiFetch(APIRoute.UpdateTeamScore, {
        teamId,
        scoreChange,
      });

      // Update local state with new score
      setTeams((prevTeams) =>
        prevTeams.map((team) =>
          team.id === teamId ? { ...team, score: response.newScore } : team
        )
      );
    } catch (error) {
      console.error("Failed to update team score:", error);
      alert(`Failed to update team score: ${error}`);
    }
  };

  return (
    <div className="h-screen relative overflow-hidden">
      <PastelBackground />
      {passwordPrompt}
      {!isAuthenticated && (
        <div className="flex flex-col items-center justify-center w-full h-full">
          <h1 className="text-4xl font-bold">Access denied</h1>
        </div>
      )}
      {isAuthenticated && (
        <div className="grid grid-cols-8 h-full w-full gap-4">
          <div className="col-start-1 col-span-1 flex flex-col items-center justify-center h-full gap-4">
            <button
              className="bg-red-600 text-white p-2 w-32 rounded-md cursor-pointer hover:bg-red-500 active:bg-red-700"
              onClick={handleResetBuzzers}
            >
              Reset buzzers
            </button>

            <h4 className="text-lg font-bold mt-8">Host navigation</h4>
            <Button
              color="blue"
              onClick={() => handleNavigateHostScreen(HostScreen.Lobby)}
              text="Lobby"
            />
            <Button
              color="blue"
              onClick={() => {
                handleNavigateHostScreen(HostScreen.BuzzerHost);
                handleNavigatePlayerScreen(PlayerScreen.Buzzer);
              }}
              text="Buzzer host"
            />
            <Button
              color="blue"
              onClick={() => {
                handleNavigateHostScreen(HostScreen.Pong);
                handleNavigatePlayerScreen(PlayerScreen.Joystick);
              }}
              text="Pong"
            />
            <Button
              color="blue"
              onClick={() => {
                handleNavigateHostScreen(HostScreen.Boat);
                handleNavigatePlayerScreen(PlayerScreen.Joystick);
              }}
              text="Boat"
            />
            <Button
              color="blue"
              onClick={() => {
                handleNavigateHostScreen(HostScreen.Ninja);
                handleNavigatePlayerScreen(PlayerScreen.Buzzer);
              }}
              text="Ninja"
            />
            <Button
              color="blue"
              onClick={() => handleNavigateHostScreen(HostScreen.Codenames)}
              text="Codenames"
            />

            <h4 className="text-lg font-bold mt-8">Player navigation</h4>
            <Button
              color="green"
              onClick={() => handleNavigatePlayerScreen(PlayerScreen.Buzzer)}
              text="Buzzer"
            />
            <Button
              color="green"
              onClick={() => handleNavigatePlayerScreen(PlayerScreen.Joystick)}
              text="Joystick"
            />
          </div>

          {/* Team Scores Column */}
          <div className="col-start-2 col-span-1 flex flex-col items-center justify-center h-full gap-4 p-4">
            <h4 className="text-lg font-bold">Scores</h4>
            {teams.map((team) => (
              <div
                key={team.id}
                className="p-3 rounded-sm w-full"
                style={{ backgroundColor: team.color }}
              >
                <div className="text-center font-bold text-md mb-2">
                  {team.name}
                </div>
                <div className="flex justify-center gap-2 mb-2">
                  <button
                    className="bg-white/80 hover:bg-white/85 rounded-full font-bold font-mono w-8 h-8 flex items-center justify-center text-xl cursor-pointer"
                    onClick={() => handleUpdateTeamScore(team.id, -1)}
                  >
                    –
                  </button>
                  <div className="text-center text-3xl font-bold mx-2">
                    {team.score}
                  </div>
                  <button
                    className="bg-white/80 hover:bg-white/85 rounded-full font-bold font-mono w-8 h-8 flex items-center justify-center text-xl cursor-pointer"
                    onClick={() => handleUpdateTeamScore(team.id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="col-start-3 col-span-3 text-gray-900 flex flex-col h-full p-6">
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
              <div className="mb-4">
                <p className="text-md text-left font-bold min-w-[150px] mb-1">
                  API ENDPOINT
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium bg-gray-100 px-2 py-2 rounded w-16">
                    {httpMethod}
                  </span>
                  <select
                    value={selectedAPI}
                    onChange={handleAPIChange}
                    className="flex-1 w-full p-2 text-md bg-gray-50 border-2 border-gray-300 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-sky-200"
                  >
                    {Object.values(APIRoute).map((route) => (
                      <option key={route} value={route}>
                        {route}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedAPI === APIRoute.SendWebSocketMessage &&
                httpMethod === "POST" && (
                  <div className="mb-4">
                    <p className="text-md text-left font-bold mb-1">
                      MESSAGE TYPE
                    </p>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedMessageType}
                        onChange={handleMessageTypeChange}
                        className="w-full p-2 text-md bg-gray-50 border-2 border-gray-300 rounded-lg
                                 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      >
                        {Object.keys(broadcastTemplates).map((key) => (
                          <option key={key} value={key}>
                            {key}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

              <div className="mb-4 flex-grow">
                <p className="text-left text-md font-bold mb-1">JSON BODY</p>
                <textarea
                  value={jsonInput}
                  onChange={handleJsonChange}
                  placeholder={
                    httpMethod === "POST"
                      ? selectedAPI === APIRoute.SendWebSocketMessage &&
                        !selectedMessageType
                        ? "Select a message type first"
                        : "Enter JSON payload or select an endpoint to auto-fill"
                      : "GET requests don't require a body"
                  }
                  className="w-full p-2 h-[70%] text-sm bg-gray-50 border-2 border-gray-300 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-sky-200 font-mono"
                  disabled={httpMethod === "GET"}
                />
              </div>

              <button
                type="submit"
                disabled={
                  isLoading ||
                  !selectedAPI ||
                  (selectedAPI === APIRoute.SendWebSocketMessage &&
                    httpMethod === "POST" &&
                    !selectedMessageType)
                }
                className={`mt-3 mb-10 w-full py-2 text-xl font-bold rounded-lg transition-all
                ${
                  !isLoading &&
                  selectedAPI &&
                  !(
                    selectedAPI === APIRoute.SendWebSocketMessage &&
                    httpMethod === "POST" &&
                    !selectedMessageType
                  )
                    ? "bg-[#238551] text-white hover:bg-[#32A467] cursor-pointer"
                    : "bg-stone-300 text-stone-500 cursor-not-allowed"
                }`}
              >
                {isLoading ? "Sending..." : "Send Request"}
              </button>
            </form>
          </div>

          <div className="col-start-6 col-span-3 h-full p-4 overflow-auto bg-opacity-80">
            <h2 className="text-xl font-bold mb-3 text-left">Response Log</h2>
            {logs.length === 0 ? (
              <p className="text-gray-500 text-left">No requests yet</p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.timestamp}
                  className="mb-3 p-2 bg-white rounded-lg shadow text-left"
                >
                  <div className="text-xs text-gray-500 mb-1">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                  <div className="mb-1">
                    <span className="font-bold">Request&nbsp;&nbsp;</span>
                    <span className="font-mono text-sm">
                      {log.request.method} {log.request.endpoint}
                    </span>
                  </div>
                  <div className="mb-1">
                    <pre className="font-mono text-sm bg-gray-100 p-1 rounded overflow-auto text-left">
                      {JSON.stringify(log.request.body, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="font-bold">Response</span>
                    <pre className="font-mono text-sm bg-gray-100 p-1 rounded overflow-auto text-left">
                      {JSON.stringify(log.response, null, 2)}
                    </pre>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
