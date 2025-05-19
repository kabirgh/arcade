import "./buzzer.css";

import nipplejs from "nipplejs";
import { useEffect, useRef, useState } from "react";

import { Channel, MessageType } from "../../shared/types/domain/websocket";
import ConnectionStatusPill from "./components/ConnectionStatusPill";
import PastelBackground from "./components/PastelBackground";
import { usePlayerContext } from "./contexts/PlayerContext";
import { useWebSocketContext } from "./contexts/WebSocketContext";

type NippleManagerType = ReturnType<typeof nipplejs.create>;

type JoystickMoveData = {
  playerId: string;
  angle: number;
  force: number;
};

export default function Joystick() {
  const { publish } = useWebSocketContext();
  const { sessionPlayer } = usePlayerContext();
  const joystickContainerRef = useRef<HTMLDivElement>(null);
  const joystickInstanceRef = useRef<NippleManagerType | null>(null);
  const joystickMoveDataRef = useRef<JoystickMoveData | null>(null);
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
    const interval = setInterval(() => {
      if (joystickMoveDataRef.current) {
        publish({
          channel: Channel.JOYSTICK,
          messageType: MessageType.MOVE,
          payload: joystickMoveDataRef.current,
        });
      }
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
        size: joystickSize, // 50vmin converted to pixels
      });
      joystickInstanceRef.current = manager;

      manager.on("move", (evt, data) => {
        joystickMoveDataRef.current = {
          playerId: sessionPlayer!.id,
          angle: data.angle.degree, // 0 is right
          force: data.force,
        };
      });

      manager.on("end", () => {
        joystickMoveDataRef.current = null;
      });

      return () => {
        if (joystickInstanceRef.current) {
          joystickInstanceRef.current.destroy();
          joystickInstanceRef.current = null;
        }
        joystickMoveDataRef.current = null;
      };
    }
  }, [publish, sessionPlayer, joystickSize]);

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
