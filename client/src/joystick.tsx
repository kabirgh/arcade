import "./buzzer.css";
import PastelBackground from "./components/PastelBackground";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { Channel, MessageType } from "../../shared/types/domain/websocket";
import ConnectionStatusPill from "./components/ConnectionStatusPill";
import nipplejs from "nipplejs";
import { useEffect, useRef } from "react";
// Define the type based on the return type of nipplejs.create
type NippleManagerType = ReturnType<typeof nipplejs.create>;

export default function Joystick() {
  const { publish, readyState } = useWebSocketContext();
  const joystickContainerRef = useRef<HTMLDivElement>(null);
  const joystickInstanceRef = useRef<NippleManagerType | null>(null);

  useEffect(() => {
    if (joystickContainerRef.current) {
      const options = {
        zone: joystickContainerRef.current,
        mode: "static" as const,
        position: { left: "50%", top: "50%" },
        color: "black",
        fadeTime: 50,
        restOpacity: 0.75,
        size: 150, // size of the joystick base
      };

      const manager = nipplejs.create(options);
      joystickInstanceRef.current = manager;

      manager.on("start", (evt, nipple) => {
        console.log("Joystick started:", nipple);
        // Example: Send a message when joystick interaction starts
        // publish({
        //   channel: Channel.MOVEMENT, // Assuming you have a MOVEMENT channel
        //   messageType: MessageType.START_MOVE,
        //   payload: { playerId: "TEST" }
        // });
      });

      manager.on("move", (evt, data) => {
        console.log("Joystick move:", data);
        // Example: Send movement data
        // publish({
        //   channel: Channel.MOVEMENT,
        //   messageType: MessageType.MOVE,
        //   payload: {
        //     playerId: "TEST",
        //     direction: data.direction, // if available from 'dir' event
        //     angle: data.angle,
        //     force: data.force,
        //     position: data.position,
        //     vector: data.vector,
        //   }
        // });
      });

      manager.on("end", (evt, nipple) => {
        console.log("Joystick ended:", nipple);
        // Example: Send a message when joystick interaction ends
        // publish({
        //   channel: Channel.MOVEMENT,
        //   messageType: MessageType.END_MOVE,
        //   payload: { playerId: "TEST" }
        // });
      });

      return () => {
        if (joystickInstanceRef.current) {
          joystickInstanceRef.current.destroy();
          joystickInstanceRef.current = null;
        }
      };
    }
  }, [publish]);

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
