import React, { useState, useEffect } from "react";
import { WebSocketMessageType } from "../../shared/types/websocket";
import { APIRoute, APIRouteToRequestSchema } from "../../shared/types/routes";
import PastelBackground from "./components/PastelBackground";
import { Value } from "@sinclair/typebox/value";

// Function to generate schema templates dynamically based on route
const generateSchemaTemplate = (route: string): any => {
  const schema = APIRouteToRequestSchema[route as APIRoute];

  if (schema) {
    // For union types like WebSocketMessageType, Value.Create might pick the first type.
    // This is generally fine for initial display if a specific sub-type isn't yet chosen.
    return Value.Create(schema);
  }
  // Return null if no schema is defined (e.g. for GET requests or routes with no body)
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

const AdminPage: React.FC = () => {
  const [selectedAPI, setSelectedAPI] = useState<string>(
    APIRoute.SendWebSocketMessage
  );
  const [jsonInput, setJsonInput] = useState<string>("");
  const [logs, setLogs] = useState<
    Array<{ request: any; response: any; timestamp: number }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [httpMethod, setHttpMethod] = useState<"GET" | "POST">("POST");
  const [selectedMessageType, setSelectedMessageType] =
    useState<string>("PLAYER/JOIN");
  const broadcastTemplates = getBroadcastTemplates();

  // Password protection using browser prompt
  // useEffect(() => {
  //   const checkPassword = () => {
  //     const password = window.prompt("Enter admin password:");
  //     if (password !== "bonk123") {
  //       alert("Incorrect password!");
  //     }
  //   };

  //   checkPassword();
  // }, []);

  // Prefill JSON schema when API endpoint or method changes
  useEffect(() => {
    if (httpMethod === "POST" && selectedAPI) {
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
      setJsonInput("");
    }
  }, [selectedAPI, httpMethod, selectedMessageType]);

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
  }, [selectedAPI, broadcastTemplates, selectedMessageType]); // Dependencies ensure this runs when API, templates, or the message type itself changes.

  const handleAPIChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAPI(e.target.value);
  };

  const handleMessageTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMessageType(e.target.value);
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonInput(e.target.value);
  };

  const handleMethodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHttpMethod(e.target.value as "GET" | "POST");
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
        alert("Invalid JSON input");
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

  // TODO: add button to send reset buzzer ws message

  return (
    <div className="h-screen relative overflow-hidden">
      <PastelBackground />
      <div className="flex h-full">
        {/* Left side - Form */}
        <div className="w-1/2 text-gray-900 flex flex-col h-full max-w-[500px] p-6 mx-auto">
          <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            {/* API Endpoint and Method Selection */}
            <div className="mb-4">
              <p className="text-left text-md font-bold mb-1">API ENDPOINT</p>
              <div className="flex items-center gap-2">
                {/* HTTP Method Radio Buttons */}
                <div className="flex items-center space-x-4 mr-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="httpMethod"
                      value="GET"
                      checked={httpMethod === "GET"}
                      onChange={handleMethodChange}
                      className="mr-1"
                    />
                    <span className="text-sm font-medium">GET</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="httpMethod"
                      value="POST"
                      checked={httpMethod === "POST"}
                      onChange={handleMethodChange}
                      className="mr-1"
                    />
                    <span className="text-sm font-medium">POST</span>
                  </label>
                </div>

                {/* API Dropdown */}
                <select
                  value={selectedAPI}
                  onChange={handleAPIChange}
                  className="flex-1 p-2 text-md bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-200"
                >
                  {Object.values(APIRoute).map((route) => (
                    <option key={route} value={route}>
                      {route}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Message Type Selector (only for SendWebSocketMessage endpoint) */}
            {selectedAPI === APIRoute.SendWebSocketMessage &&
              httpMethod === "POST" && (
                <div className="mb-4">
                  <p className="text-left text-md font-bold mb-1">
                    MESSAGE TYPE
                  </p>
                  <select
                    value={selectedMessageType}
                    onChange={handleMessageTypeChange}
                    className="w-full p-2 text-md bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-200"
                  >
                    {Object.keys(broadcastTemplates).map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            {/* JSON Input */}
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
                className="w-full p-2 h-[60%] text-md bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-200 font-mono"
              />
            </div>

            {/* Submit Button */}
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

        {/* Right side - Logs */}
        <div className="w-1/2 h-full p-4 overflow-auto bg-white bg-opacity-80">
          <h2 className="text-xl font-bold mb-3 text-left">Response Log</h2>
          {logs.length === 0 ? (
            <p className="text-gray-500 text-left">No requests yet</p>
          ) : (
            logs.map((log, index) => (
              <div
                key={log.timestamp}
                className="mb-3 p-2 bg-white rounded-lg shadow text-left"
              >
                <div className="text-xs text-gray-500 mb-1">
                  {new Date(log.timestamp).toLocaleString()}
                </div>
                <div className="mb-1">
                  <span className="font-bold">Request: </span>
                  <span className="font-mono text-sm">
                    {log.request.method} {log.request.endpoint}
                  </span>
                </div>
                <div className="mb-1">
                  <span className="font-bold">Body: </span>
                  <pre className="font-mono text-sm bg-gray-100 p-1 rounded overflow-auto text-left">
                    {JSON.stringify(log.request.body, null, 2)}
                  </pre>
                </div>
                <div>
                  <span className="font-bold">Response: </span>
                  <pre className="font-mono text-sm bg-gray-100 p-1 rounded overflow-auto text-left">
                    {JSON.stringify(log.response, null, 2)}
                  </pre>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
