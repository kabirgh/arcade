import "./buzzer.css";

import nipplejs from "nipplejs";
import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { useLocation } from "wouter";

import { PlayerScreen } from "../../shared/types/domain/misc";
import { Channel, MessageType } from "../../shared/types/domain/websocket";
import ConnectionStatusPill from "./components/ConnectionStatusPill";
import PastelBackground from "./components/PastelBackground";
import { usePlayerContext } from "./contexts/PlayerContext";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { useListenPlayerNavigate } from "./hooks/useListenPlayerNavigate";

type NippleManagerType = ReturnType<typeof nipplejs.create>;

type JoystickMoveData = {
  playerId: string;
  angle: number;
  force: number;
};

// Define how much larger the container should be than the joystick (total extra size in vmin)
const CONTAINER_PADDING_TOTAL_VMIN = 12;

// Helper function to convert vmin to pixels
const vminToPixels = (vmin: number): number => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const minDimension = Math.min(vw, vh);
  return (vmin / 100) * minDimension;
};

export default function Joystick() {
  const [, setLocation] = useLocation();
  const { publish } = useWebSocketContext();
  const { sessionPlayer } = usePlayerContext();
  useListenPlayerNavigate(sessionPlayer);
  const joystickContainerRef = useRef<HTMLDivElement>(null);
  const joystickInstanceRef = useRef<NippleManagerType | null>(null);
  const joystickMoveDataRef = useRef<JoystickMoveData>({
    playerId: sessionPlayer?.id ?? "",
    angle: 0,
    force: 0,
  });
  const previousMoveDataRef = useRef<JoystickMoveData>({
    playerId: "",
    angle: -1,
    force: -1,
  });
  const [joystickSize, setJoystickSize] = useState<number>(vminToPixels(60));

  // Calculate min and max sizes in pixels
  const minSizePx = vminToPixels(20);
  const maxSizePx = vminToPixels(90);
  const deltaSizePx = vminToPixels(10);
  const containerExtraSizePx = vminToPixels(CONTAINER_PADDING_TOTAL_VMIN);
  const joystickContainerDimension = joystickSize + containerExtraSizePx;

  useEffect(() => {
    if (!sessionPlayer) {
      console.warn("No session player found");
      setLocation(PlayerScreen.Join);
      return;
    }
  }, [sessionPlayer, setLocation]);

  const increaseSize = () => {
    setJoystickSize((prev) => Math.min(prev + deltaSizePx, maxSizePx));
  };

  const decreaseSize = () => {
    setJoystickSize((prev) => Math.max(prev - deltaSizePx, minSizePx));
  };

  useEffect(() => {
    if (sessionPlayer) {
      joystickMoveDataRef.current!.playerId = sessionPlayer.id;
    }
  }, [sessionPlayer]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (joystickMoveDataRef.current.playerId === "") {
        return;
      }

      const current = joystickMoveDataRef.current;
      const previous = previousMoveDataRef.current;

      // Only publish if data has changed
      if (
        current.playerId === previous.playerId &&
        current.angle === previous.angle &&
        current.force === previous.force
      ) {
        return;
      }

      publish({
        channel: Channel.JOYSTICK,
        messageType: MessageType.MOVE,
        payload: current,
      });

      // Update previous data
      previousMoveDataRef.current = {
        playerId: current.playerId,
        angle: current.angle,
        force: current.force,
      };
    }, 16); // 60 fps

    return () => clearInterval(interval);
  }, [publish]);

  useEffect(() => {
    if (joystickContainerRef.current && joystickSize > 0) {
      // Destroy previous instance if it exists
      if (joystickInstanceRef.current) {
        joystickInstanceRef.current.destroy();
      }

      const manager = nipplejs.create({
        zone: joystickContainerRef.current,
        mode: "static" as const,
        position: { left: "50%", top: "50%" },
        color: "black",
        fadeTime: 50,
        restOpacity: 0.8,
        size: joystickSize,
      });
      joystickInstanceRef.current = manager;

      manager.on("start", () => {
        joystickMoveDataRef.current!.angle = 0;
        joystickMoveDataRef.current!.force = 0;
      });

      manager.on("move", (_evt, data) => {
        joystickMoveDataRef.current!.angle = data.angle.radian; // 0 is right
        joystickMoveDataRef.current!.force = Math.min(data.force, 1);
      });

      manager.on("end", () => {
        joystickMoveDataRef.current!.angle = 0;
        joystickMoveDataRef.current!.force = 0;
      });

      return () => {
        if (joystickInstanceRef.current) {
          joystickInstanceRef.current.destroy();
          joystickInstanceRef.current = null;
        }
      };
    }
  }, [publish, joystickSize]);

  return (
    <div className="flex flex-col items-center justify-center h-screen relative overflow-hidden select-none">
      <Toaster />
      <PastelBackground />
      <ConnectionStatusPill />

      {/* Joystick Size Controls */}
      <div className="absolute top-[15%] left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex items-center gap-8 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm">
          <button
            onClick={decreaseSize}
            disabled={joystickSize <= minSizePx}
            className="w-8 h-8 rounded-full bg-white/30 hover:bg-white/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-gray-800 font-bold transition-colors"
          >
            −
          </button>
          <button
            onClick={increaseSize}
            disabled={joystickSize >= maxSizePx}
            className="w-8 h-8 rounded-full bg-white/30 hover:bg-white/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-gray-800 font-bold transition-colors"
          >
            +
          </button>
        </div>
      </div>

      <div
        ref={joystickContainerRef}
        className="absolute flex items-center justify-center"
        style={{
          touchAction: "none",
          width: `${joystickContainerDimension}px`,
          height: `${joystickContainerDimension}px`,
          top: "70%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* The joystick will be created here by nipplejs */}
      </div>
    </div>
  );
}
