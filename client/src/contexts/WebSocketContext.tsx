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

// Define the context type
interface WebSocketContextType {
  subscribe: (
    channel: Channel,
    callback: (message: WebSocketMessage) => void
  ) => void;
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
  // WebSocket reference
  const ws = useRef<WebSocket | null>(null);
  // Map channels to callbacks
  const channels = useRef<
    Map<Channel, Set<(message: WebSocketMessage) => void>>
  >(new Map());
  // Track connection status with state in case children need to re-render based on status
  const [status, setStatus] =
    useState<WebSocketConnectionStatus>("disconnected");

  // Subscribe to a channel
  const subscribe = useCallback(
    (channel: Channel, callback: (message: WebSocketMessage) => void) => {
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
      console.warn("[WebSocket] Not connected, unable to send message");
    }
  }, []);

  // Initialize WebSocket on mount
  useEffect(() => {
    // Set up WebSocket connection
    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      console.log(`[${new Date().toISOString()}] [WebSocket] Connected`);
      setStatus("connected");
    };

    ws.current.onclose = () => {
      console.log(`[${new Date().toISOString()}] [WebSocket] Disconnected`);
      setStatus("disconnected");

      // Simple reconnect after 1 second
      setTimeout(() => {
        if (ws.current?.readyState !== WebSocket.OPEN) {
          console.log(
            `[${new Date().toISOString()}] [WebSocket] Attempting reconnection`
          );
          ws.current = new WebSocket(WS_URL);
        }
      }, 1000);
    };

    ws.current.onerror = (error) => {
      console.error(`[${new Date().toISOString()}] [WebSocket] Error:`, error);
    };

    ws.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        // Notify subscribers for this channel
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

    // Clean up on unmount
    return () => {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, []); // Empty dependency array - run once on mount

  return (
    <WebSocketContext.Provider
      value={{
        subscribe,
        unsubscribe,
        publish,
        status: status, // Use state instead of ref
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
