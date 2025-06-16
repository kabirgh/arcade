import "./buzzer.css";

import { useEffect, useRef } from "react";
import { toast, Toaster } from "sonner";
import { useLocation } from "wouter";

import { PlayerScreen } from "../../shared/types/domain/misc";
import { Channel, MessageType } from "../../shared/types/domain/websocket";
import ConnectionStatusPill from "./components/ConnectionStatusPill";
import PastelBackground from "./components/PastelBackground";
import { usePlayerContext } from "./contexts/PlayerContext";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { useListenPlayerNavigate } from "./hooks/useListenPlayerNavigate";

const DEBOUNCE_TIME_MS = 150;

export default function Buzzer() {
  const [, setLocation] = useLocation();
  const { publish } = useWebSocketContext();
  const { sessionPlayer } = usePlayerContext();
  useListenPlayerNavigate(sessionPlayer);
  const lastPressedRef = useRef<number>(0);

  useEffect(() => {
    if (!sessionPlayer) {
      console.warn("No session player found");
      setLocation(PlayerScreen.Join);
      return;
    }
  }, [sessionPlayer, setLocation]);

  const handlePress = () => {
    if (!sessionPlayer) {
      console.error("No session player found");
      toast.error("No session player found");
      return;
    }

    const now = Date.now();
    if (now - lastPressedRef.current < DEBOUNCE_TIME_MS) {
      return;
    }
    lastPressedRef.current = now;

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
      <Toaster />
      <PastelBackground />
      <ConnectionStatusPill />
      <div className="flex items-center justify-center w-[80vmin] h-[80vmin]">
        <button className="pushable" onPointerDown={handlePress}>
          <span className="shadow"></span>
          <span className="edge"></span>
          <span className="front"></span>
        </button>
      </div>
    </div>
  );
}
