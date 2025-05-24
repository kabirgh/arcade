import "./buzzer.css";

import nipplejs from "nipplejs";
import { useEffect, useRef, useState } from "react";

import { Channel, MessageType } from "../../shared/types/domain/websocket";
import ConnectionStatusPill from "./components/ConnectionStatusPill";
import PastelBackground from "./components/PastelBackground";
import { usePlayerContext } from "./contexts/PlayerContext";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { useListenNavigate } from "./hooks/useListenNavigate";

type NippleManagerType = ReturnType<typeof nipplejs.create>;

type JoystickMoveData = {
  playerId: string;
  angle: number;
  force: number;
};

export default function Joystick() {
  useListenNavigate("player");
  const { publish } = useWebSocketContext();
  const { sessionPlayer } = usePlayerContext();
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
  const [joystickSize, setJoystickSize] = useState<number>(0);

  // Calculate 40vmin in pixels
  useEffect(() => {
    const calculateSize = () => {
      const vmin = Math.min(window.innerWidth, window.innerHeight) * 0.4;
      setJoystickSize(vmin);
    };

    calculateSize();
    window.addEventListener("resize", calculateSize);

    return () => window.removeEventListener("resize", calculateSize);
  }, []);

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
    }, 33); // 30 fps

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
        position: { left: "50%", top: "67%" },
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
    <div className="flex flex-col items-center justify-center h-screen relative overflow-hidden">
      <PastelBackground />
      <ConnectionStatusPill />
      <div
        ref={joystickContainerRef}
        className="flex items-center justify-center w-[80vmin] h-[80vmin] relative"
        style={{ touchAction: "none" }} // Important for touch interactions
      >
        {/* The joystick will be created here by nipplejs */}
      </div>
    </div>
  );
}
