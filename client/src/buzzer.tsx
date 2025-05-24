import "./buzzer.css";

import { Channel, MessageType } from "../../shared/types/domain/websocket";
import ConnectionStatusPill from "./components/ConnectionStatusPill";
import PastelBackground from "./components/PastelBackground";
import { usePlayerContext } from "./contexts/PlayerContext";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { useListenNavigate } from "./hooks/useListenNavigate";

export default function Buzzer() {
  useListenNavigate("player");
  const { publish } = useWebSocketContext();
  const { sessionPlayer } = usePlayerContext();

  const handlePress = () => {
    if (!sessionPlayer) {
      console.error("No session player found");
      return;
    }

    publish({
      channel: Channel.BUZZER,
      messageType: MessageType.BUZZ,
      payload: {
        playerId: sessionPlayer.id,
        timestamp: Date.now(),
      },
    });
  };

  return (
    <div className="buzzer-component flex flex-col items-center justify-center h-screen relative overflow-hidden">
      <PastelBackground />
      <ConnectionStatusPill />
      <div className="flex items-center justify-center w-[80vmin] h-[80vmin]">
        <button
          className="pushable"
          onTouchStart={handlePress}
          onMouseDown={handlePress}
        >
          <span className="shadow"></span>
          <span className="edge"></span>
          <span className="front"></span>
        </button>
      </div>
    </div>
  );
}
