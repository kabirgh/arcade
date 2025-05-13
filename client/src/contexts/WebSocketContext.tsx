import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
} from "react";
import type {
  WebSocketMessage,
  WebSocketConnectionStatus,
} from "../../../shared/types/websocket";
import { Channel } from "../../../shared/types/websocket";

// Use relative URL for WebSocket connection
const WS_URL = `ws://${window.location.hostname}:3001/ws`;

type WebSocketCallback = (message: WebSocketMessage) => void;

// Define the context type
interface WebSocketContextType {
  subscribe: (channel: Channel, callback: WebSocketCallback) => void;
  unsubscribe: (channel: Channel) => void;
  publish: (message: WebSocketMessage) => void;
  status: WebSocketConnectionStatus;
}

// Create the context
const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

// Custom hook to use the WebSocket context
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};

// WebSocket Provider component
export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const ws = useRef<WebSocket | null>(null);
  const channels = useRef<Map<Channel, Set<WebSocketCallback>>>(new Map());
  const [status, setStatus] =
    useState<WebSocketConnectionStatus>("disconnected");

  const connectWebSocket = useCallback(() => {
    // If there's an existing WebSocket, ensure it's properly closed before creating a new one.
    // This helps prevent multiple connections if connectWebSocket is called unexpectedly.
    if (ws.current) {
      // Remove event listeners to prevent them from firing on an old instance
      ws.current.onopen = null;
      ws.current.onmessage = null;
      ws.current.onerror = null;
      ws.current.onclose = null;
      // Close if it's in a connecting or open state
      if (
        ws.current.readyState === WebSocket.OPEN ||
        ws.current.readyState === WebSocket.CONNECTING
      ) {
        console.log(
          `[${new Date().toISOString()}] [WebSocket] Closing existing connection before reconnecting.`
        );
        ws.current.close();
      }
    }

    console.log(
      `[${new Date().toISOString()}] [WebSocket] Attempting to connect...`
    );
    const socket = new WebSocket(WS_URL);
    // Assign to ws.current immediately so other parts of the code can reference it,
    // e.g., to check readyState, even if it's still connecting.
    ws.current = socket;

    socket.onopen = () => {
      console.log(`[${new Date().toISOString()}] [WebSocket] Connected`);
      setStatus("connected");
    };

    socket.onclose = (event) => {
      console.log(
        `[${new Date().toISOString()}] [WebSocket] Disconnected. Code: ${
          event.code
        }, Reason: ${event.reason}`
      );
      setStatus("disconnected");
      // Only try to reconnect if this socket (ws.current at the time of closure) was the one this handler was attached to.
      // And ensure we are not in a state where the component is unmounting (handled by useEffect cleanup).
      if (ws.current === socket) {
        // Check if it's the same instance that triggered this onclose
        ws.current = null; // Clear the current socket ref as it's now closed
        // Simple reconnect after 2 seconds. More sophisticated strategies could be used (e.g., exponential backoff).
        console.log(
          `[${new Date().toISOString()}] [WebSocket] Attempting reconnection in 1 second...`
        );
        setTimeout(connectWebSocket, 2000);
      } else {
        console.log(
          `[${new Date().toISOString()}] [WebSocket] Old socket closed, no auto-reconnect.`
        );
      }
    };

    socket.onerror = (error) => {
      console.error(`[${new Date().toISOString()}] [WebSocket] Error:`, error);
      // Note: 'onerror' will usually be followed by 'onclose', which handles reconnection.
    };

    socket.onmessage = (event) => {
      try {
        // Ensure event.data is a string before parsing
        if (typeof event.data !== "string") {
          console.error(
            `[${new Date().toISOString()}] [WebSocket] Received non-string message:`,
            event.data
          );
          return;
        }
        const message: WebSocketMessage = JSON.parse(event.data);

        const callbacks = channels.current.get(message.channel);
        if (callbacks) {
          callbacks.forEach((callback) => {
            try {
              callback(message);
            } catch (err) {
              console.error(
                `[${new Date().toISOString()}] Error in subscriber callback:`,
                err
              );
            }
          });
        }
      } catch (err) {
        console.error(
          `[${new Date().toISOString()}] Error parsing WebSocket message:`,
          err
        );
      }
    };
  }, []); // WS_URL is module-level constant, so useCallback has no dependencies.

  // Subscribe to a channel
  const subscribe = useCallback(
    (channel: Channel, callback: WebSocketCallback) => {
      if (!channels.current.has(channel)) {
        channels.current.set(channel, new Set());
      }
      channels.current.get(channel)!.add(callback);
    },
    []
  );

  // Unsubscribe from a channel
  const unsubscribe = useCallback((channel: Channel) => {
    channels.current.delete(channel);
  }, []);

  // Send a message to the server
  const publish = useCallback((message: WebSocketMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn(
        `[WebSocket] Not connected (readyState: ${ws.current?.readyState}), unable to send message`,
        message
      );
    }
  }, []);

  useEffect(() => {
    connectWebSocket();

    // Clean up on unmount
    return () => {
      if (ws.current) {
        console.log(
          `[${new Date().toISOString()}] [WebSocket] Cleaning up WebSocket connection on unmount.`
        );
        // Crucially, remove the onclose handler or set it to null before closing.
        // This prevents the onclose handler from attempting to reconnect after the component has unmounted.
        ws.current.onclose = null;
        ws.current.onerror = null;
        ws.current.close();
        ws.current = null;
      }
    };
  }, [connectWebSocket]); // useEffect depends on the connectWebSocket function instance

  return (
    <WebSocketContext.Provider
      value={{
        subscribe,
        unsubscribe,
        publish,
        status,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
