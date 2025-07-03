import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ReadyState } from "react-use-websocket";
import { toast } from "sonner";
import { useLocation } from "wouter";

import { APIRoute } from "../../../shared/types/api/schema";
import { PlayerScreen } from "../../../shared/types/domain/misc";
import type { Player } from "../../../shared/types/domain/player";
import { MessageType } from "../../../shared/types/domain/websocket";
import { Channel } from "../../../shared/types/domain/websocket";
import { apiFetch } from "../util/apiFetch";
import { useWebSocketContext } from "./WebSocketContext";

// Define the shape of the context data
interface PlayerContextType {
  sessionPlayer: Player | null;
  setSessionPlayer: (player: Player) => void;
  clearSessionPlayer: () => void;
}

// Create the context with a default undefined value
const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// Create the Provider component
export const PlayerProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [, setLocation] = useLocation();
  const { publish, readyState, subscribe } = useWebSocketContext();
  const [player, setPlayer] = useState<Player | null>(() => {
    try {
      const storedPlayer = localStorage.getItem("player");
      return storedPlayer ? (JSON.parse(storedPlayer) as Player) : null;
    } catch (error) {
      // Toaster must be present in the parent component to show the error
      console.error("Failed to load player data", error);
      toast.error("Failed to load player data: " + error, {
        closeButton: true,
        position: "top-center",
      });
      localStorage.removeItem("player"); // Clear corrupted data
      return null;
    }
  });
  // Track whether session validation is complete so we only send JOIN message after validation
  const [sessionValidated, setSessionValidated] = useState(false);

  // Function to update player state and localStorage
  // Another useEffect sends the JOIN message to the server when readyState is OPEN
  const setSessionPlayer = useCallback((newPlayer: Player) => {
    setPlayer(newPlayer);
    try {
      localStorage.setItem("player", JSON.stringify(newPlayer));
    } catch (error) {
      // Toaster must be present in the parent component to show the error
      console.error("Failed to save player data", error);
      toast.error("Failed to save player data: " + error, {
        closeButton: true,
        position: "top-center",
      });
    }
  }, []);

  const clearSessionPlayer = useCallback(() => {
    const playerName = player?.name ?? "";
    setPlayer(null);
    localStorage.removeItem("player");
    if (readyState === ReadyState.OPEN) {
      publish({
        channel: Channel.PLAYER,
        messageType: MessageType.LEAVE,
        payload: {
          playerName: playerName,
        },
      });
    } else {
      localStorage.setItem("playerDueToLeave", "true");
    }
  }, [publish, readyState, player]);

  const refreshSessionId = useCallback(() => {
    apiFetch(APIRoute.SessionId).then(({ sessionId: fetchedSessionId }) => {
      const storedSessionId = localStorage.getItem("sessionId");
      // If its a new session, clear player data
      if (storedSessionId !== fetchedSessionId) {
        clearSessionPlayer();
        localStorage.setItem("sessionId", fetchedSessionId);
      }
      // Mark session validation as complete
      setSessionValidated(true);
    });
  }, [clearSessionPlayer]);

  // Refresh session ID on mount
  useEffect(() => {
    refreshSessionId();

    return () => {
      // Require session validation on next mount
      setSessionValidated(false);
    };
  }, [refreshSessionId]);

  // Handles:
  // 1. setSessionPlayer - sends JOIN message to server.
  // 2. Page refresh - sends JOIN message to server if there's a player in localStorage.
  //    We need to do this because when the client disconnects, the server will
  //    remove the player from the list so we need to send a JOIN message to the
  //    server to re-add the player to the list
  // Wait for session validation before sending JOIN message
  useEffect(() => {
    if (readyState === ReadyState.OPEN && player && sessionValidated) {
      publish({
        channel: Channel.PLAYER,
        messageType: MessageType.JOIN,
        payload: player,
      });
    }
  }, [player, publish, readyState, sessionValidated]);

  // If player is due to leave, send LEAVE message to server
  useEffect(() => {
    const playerDueToLeave = localStorage.getItem("playerDueToLeave");
    if (readyState === ReadyState.OPEN && playerDueToLeave === "true") {
      setPlayer(null);
      publish({
        channel: Channel.PLAYER,
        messageType: MessageType.LEAVE,
        payload: {
          playerName: player?.name ?? "",
        },
      });
      localStorage.removeItem("playerDueToLeave");
    }
  }, [publish, readyState, player]);

  // Remove player if kicked by server
  useEffect(() => {
    const unsubscribe = subscribe(Channel.PLAYER, (message) => {
      if (message.messageType === MessageType.KICK) {
        clearSessionPlayer();
        // Refresh session ID in case the server has started a new session
        refreshSessionId();
        // Don't care about publishing LEAVE beause server has already removed the player
        setLocation(PlayerScreen.Join);
      }
    });

    return unsubscribe;
  }, [clearSessionPlayer, refreshSessionId, subscribe, setLocation]);

  return (
    <PlayerContext.Provider
      value={{ sessionPlayer: player, setSessionPlayer, clearSessionPlayer }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

// Custom hook to use the PlayerContext
export const usePlayerContext = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error("usePlayerContext must be used within a PlayerProvider");
  }
  return context;
};
