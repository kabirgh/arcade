import { useEffect, useState } from "react";
import { ReadyState } from "react-use-websocket";

import { Channel, MessageType } from "../../../shared/types/domain/websocket";
import { useWebSocketContext } from "../contexts/WebSocketContext";

export const useAdminAuth = ({
  claimHost = false,
}: { claimHost?: boolean } = {}) => {
  const { publish, readyState } = useWebSocketContext();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Skip authentication in development mode
    if (process.env.NODE_ENV === "development") {
      console.log("Skipping authentication in development mode");
      return true;
    }
    return sessionStorage.getItem("isAdminAuthenticated") === "true";
  });

  useEffect(() => {
    // Check if already authenticated in this session
    if (isAuthenticated) {
      if (claimHost && readyState === ReadyState.OPEN) {
        publish({
          channel: Channel.ADMIN,
          messageType: MessageType.CLAIM_HOST,
        });
      }
      return; // Don't prompt if already authenticated
    }

    const password = window.prompt("Enter admin password:");
    if (password === "bonk123") {
      setIsAuthenticated(true);
      sessionStorage.setItem("isAdminAuthenticated", "true");
      if (claimHost && readyState === ReadyState.OPEN) {
        publish({
          channel: Channel.ADMIN,
          messageType: MessageType.CLAIM_HOST,
        });
      }
    } else {
      // Only show "Incorrect password!" if the user entered something and it was wrong.
      // If `password` is `null`, the user cancelled the prompt.
      if (password !== null) {
        alert("Incorrect password!");
      }
      // If password was incorrect or prompt was cancelled, isAdminAuthenticated in session storage remains not "true".
      // So, on next mount (e.g., refresh or re-navigation), it will prompt again.
    }
  }, [claimHost, isAuthenticated, publish, readyState]);

  return { isAuthenticated };
};
