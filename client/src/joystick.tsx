import "./buzzer.css";

import nipplejs from "nipplejs";
import { useEffect, useRef } from "react";

import { Channel, MessageType } from "../../shared/types/domain/websocket";
import ConnectionStatusPill from "./components/ConnectionStatusPill";
import PastelBackground from "./components/PastelBackground";
import { usePlayerContext } from "./contexts/PlayerContext";
import { useWebSocketContext } from "./contexts/WebSocketContext";
// Define the type based on the return type of nipplejs.create
type NippleManagerType = ReturnType<typeof nipplejs.create>;

export default function Joystick() {
  const { publish } = useWebSocketContext();
  const { sessionPlayer } = usePlayerContext();
  const joystickContainerRef = useRef<HTMLDivElement>(null);
  const joystickInstanceRef = useRef<NippleManagerType | null>(null);
  const lastMoveTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (joystickContainerRef.current) {
      const manager = nipplejs.create({
        zone: joystickContainerRef.current,
        mode: "static" as const,
        position: { left: "50%", top: "50%" },
        color: "black",
        fadeTime: 50,
        restOpacity: 0.75,
        size: 150, // size of the joystick base
      });
      joystickInstanceRef.current = manager;

      manager.on("move", (evt, data) => {
        console.log("Joystick move:", data, Date.now());
        if (Date.now() - lastMoveTimeRef.current < 20) {
          return;
        }
        lastMoveTimeRef.current = Date.now();
        publish({
          channel: Channel.JOYSTICK,
          messageType: MessageType.MOVE,
          payload: {
            playerId: sessionPlayer!.id,
            angle: data.angle.degree,
            force: data.force,
          },
        });
      });

      return () => {
        if (joystickInstanceRef.current) {
          joystickInstanceRef.current.destroy();
          joystickInstanceRef.current = null;
        }
      };
    }
  }, [publish, sessionPlayer]);

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
