import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";

import config from "../../../config";
import type { WebSocketMessage } from "../../../shared/types/api/websocket";
import { Channel } from "../../../shared/types/domain/websocket";

// Determine WebSocket URL based on environment and hosting mode
function getWebSocketUrl(): string {
  const isDev = import.meta.env.DEV;

  if (isDev) {
    // Development: connect directly to backend server
    const port =
      config.mode === "internet" ? config.internet.port : config.server.port;
    const protocol = config.mode === "internet" ? "wss:" : "ws:";
    return `${protocol}//${window.location.hostname}:${port}/ws`;
  } else {
    // Production: server serves everything on same origin
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  }
}

const WS_URL = getWebSocketUrl();

type WebSocketCallback = (message: WebSocketMessage) => void;

// Define the context type
interface WebSocketContextType {
  subscribe: (channel: Channel, callback: WebSocketCallback) => () => void; // Returns unsubscribe function
  publish: (message: WebSocketMessage) => void;
  readyState: ReadyState;
}

// Create the context
const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

// Custom hook to use the WebSocket context
export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error(
      "useWebSocketContext must be used within a WebSocketProvider"
    );
  }
  return context;
};

// WebSocket Provider component
export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const channels = useRef<Map<Channel, Set<WebSocketCallback>>>(new Map());

  const { sendMessage, lastMessage, readyState } = useWebSocket(WS_URL, {
    onOpen: () => {
      console.log(`[${new Date().toISOString()}] [WebSocket] Connected`);
    },
    onClose: (event: CloseEvent) => {
      console.log(
        `[${new Date().toISOString()}] [WebSocket] Disconnected. Code: ${
          event.code
        }, Reason: ${event.reason}`
      );
    },
    onError: (event: Event) => {
      console.error(`[${new Date().toISOString()}] [WebSocket] Error:`, event);
    },
    shouldReconnect: (closeEvent: CloseEvent) => {
      console.log(
        `[${new Date().toISOString()}] [WebSocket] Close event code: ${
          closeEvent.code
        }. Attempting reconnection...`
      );
      return true; // Instructs react-use-websocket to attempt reconnection
    },
    reconnectAttempts: 100,
    reconnectInterval: 3000,
  });

  // Handle incoming messages from react-use-websocket
  useEffect(() => {
    const date = new Date().toISOString();
    if (lastMessage && lastMessage.data) {
      try {
        // Ensure event.data is a string before parsing
        if (typeof lastMessage.data !== "string") {
          console.error(
            `[${date}] [WebSocket] Received non-string message:`,
            lastMessage.data
          );
          return;
        }
        const message: WebSocketMessage = JSON.parse(
          lastMessage.data as string
        );

        const callbacks = channels.current.get(message.channel);
        if (callbacks) {
          callbacks.forEach((callback) => {
            try {
              callback(message);
            } catch (err) {
              console.error(`[${date}] Error in subscriber callback:`, err);
            }
          });
        }
      } catch (err) {
        console.error(`[${date}] Error parsing WebSocket message:`, err);
      }
    }
  }, [lastMessage]);

  // Subscribe to a channel
  const subscribe = useCallback(
    (channel: Channel, callback: WebSocketCallback) => {
      if (!channels.current.has(channel)) {
        channels.current.set(channel, new Set());
      }
      channels.current.get(channel)!.add(callback);

      // Return an unsubscribe function for this specific callback
      return () => {
        const callbacks = channels.current.get(channel);
        if (callbacks) {
          callbacks.delete(callback);
          // If no more callbacks for this channel, remove the channel entirely
          if (callbacks.size === 0) {
            channels.current.delete(channel);
          }
        }
      };
    },
    []
  );

  // Send a message to the server
  const publish = useCallback(
    (message: WebSocketMessage) => {
      if (readyState === ReadyState.OPEN) {
        sendMessage(JSON.stringify(message));
      } else {
        console.warn(
          `[WebSocket] Not connected (readyState: ${readyState}), unable to send message`,
          message
        );
      }
    },
    [readyState, sendMessage]
  );

  return (
    <WebSocketContext.Provider
      value={{
        subscribe,
        publish,
        readyState,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
