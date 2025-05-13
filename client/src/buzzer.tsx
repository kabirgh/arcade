import { useState } from "react";
import PastelBackground from "./components/PastelBackground";
import { useWebSocket } from "./contexts/WebSocketContext";
import { Channel, MessageType } from "../../shared/types/websocket";

export default function Buzzer() {
  const [isPressed, setIsPressed] = useState(false);
  const { publish } = useWebSocket();

  const handlePress = () => {
    setIsPressed(true);
    console.log("Publishing buzz message");
    publish({
      channel: Channel.BUZZER,
      messageType: MessageType.BUZZ,
      payload: {
        playerName: "TEST",
      },
    });
  };

  const handleRelease = () => {
    setIsPressed(false);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen relative overflow-hidden">
      <PastelBackground />
      <button
        className={`w-[200px] h-[200px] rounded-full bg-red-500 transition-all duration-100 ease-in-out ${
          isPressed ? "transform scale-90 shadow-2xl shadow-inner" : "shadow-lg"
        }`}
        onMouseDown={handlePress}
        onTouchStart={handlePress}
        onMouseUp={handleRelease}
        onMouseLeave={handleRelease}
        onTouchEnd={handleRelease}
      ></button>
    </div>
  );
}
