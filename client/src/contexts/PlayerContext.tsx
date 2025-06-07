import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ReadyState } from "react-use-websocket";

import { PlayerScreen } from "../../../shared/types/domain/misc";
import type { Player } from "../../../shared/types/domain/player";
import { MessageType } from "../../../shared/types/domain/websocket";
import { Channel } from "../../../shared/types/domain/websocket";
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
  const { publish, readyState, subscribe } = useWebSocketContext();
  const [player, setPlayer] = useState<Player | null>(null);
  // Function to update player state and localStorage
  // Another useEffect sends the JOIN message to the server when readyState is OPEN
  const setSessionPlayer = useCallback((newPlayer: Player) => {
    setPlayer(newPlayer);
    try {
      localStorage.setItem("player", JSON.stringify(newPlayer));
    } catch (error) {
      // TODO: show error to user
      console.error("Failed to save player data to localStorage", error);
    }
  }, []);

  const clearSessionPlayer = useCallback(() => {
    const storedPlayer = localStorage.getItem("player");

    if (storedPlayer && readyState === ReadyState.OPEN) {
      localStorage.removeItem("player");
      publish({
        channel: Channel.PLAYER,
        messageType: MessageType.LEAVE,
      });
    }
  }, [publish, readyState]);

  // Load player from localStorage on initial mount
  useEffect(() => {
    try {
      const storedPlayer = localStorage.getItem("player");
      if (storedPlayer) {
        setPlayer(JSON.parse(storedPlayer));
      }
    } catch (error) {
      console.error("Failed to parse player data from localStorage", error);
      localStorage.removeItem("player"); // Clear corrupted data
    }
  }, []);

  // Handles:
  // 1. setSessionPlayer - sends JOIN message to server.
  // 2. Page refresh - sends JOIN message to server if there's a player in localStorage.
  //    We need to do this because when the client disconnects, the server will
  //    remove the player from the list so we need to send a JOIN message to the
  //    server to re-add the player to the list
  useEffect(() => {
    if (readyState === ReadyState.OPEN && player) {
      publish({
        channel: Channel.PLAYER,
        messageType: MessageType.JOIN,
        payload: player,
      });
    }
  }, [player, publish, readyState]);

  // Remove player if kicked by server
  useEffect(() => {
    const unsubscribe = subscribe(Channel.PLAYER, (message) => {
      if (message.messageType === MessageType.KICK) {
        clearSessionPlayer();
      }
    });

    return unsubscribe;
  }, [clearSessionPlayer, subscribe]);

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
