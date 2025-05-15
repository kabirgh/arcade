import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import type { Player } from "../../../shared/types/player";
import { MessageType } from "../../../shared/types/websocket";
import { Channel } from "../../../shared/types/websocket";
import { useWebSocketContext } from "./WebSocketContext";

// Define the shape of the context data
interface PlayerContextType {
  sessionPlayer: Player | null;
  setSessionPlayer: (player: Player | null) => void;
}

// Create the context with a default undefined value
const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// Create the Provider component
export const PlayerProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { publish } = useWebSocketContext();
  const [player, setPlayer] = useState<Player | null>(null);

  // Load player from localStorage on initial mount
  useEffect(() => {
    try {
      const storedPlayer = localStorage.getItem("player");
      if (storedPlayer) {
        setPlayer(JSON.parse(storedPlayer));
        // When the client disconnects, the server will remove the player from the list
        // so we need to send a JOIN message to the server to re-add the player to the list
        publish({
          channel: Channel.PLAYER,
          messageType: MessageType.JOIN,
          payload: JSON.parse(storedPlayer),
        });
      }
    } catch (error) {
      console.error("Failed to parse player data from localStorage", error);
      localStorage.removeItem("player"); // Clear corrupted data
    }
  }, [publish]);

  // Function to update player state and localStorage
  const setSessionPlayer = useCallback(
    (newPlayer: Player | null) => {
      setPlayer(newPlayer);

      if (newPlayer) {
        try {
          localStorage.setItem("player", JSON.stringify(newPlayer));
          // Notify the server that the player has joined
          publish({
            channel: Channel.PLAYER,
            messageType: MessageType.JOIN,
            payload: newPlayer,
          });
        } catch (error) {
          console.error("Failed to save player data to localStorage", error);
        }
      } else {
        localStorage.removeItem("player");
        // Notify the server that the player has left
        publish({
          channel: Channel.PLAYER,
          messageType: MessageType.LEAVE,
        });
      }
    },
    [publish]
  );

  return (
    <PlayerContext.Provider value={{ sessionPlayer: player, setSessionPlayer }}>
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
