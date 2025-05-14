import "./buzzer.css";
import PastelBackground from "./components/PastelBackground";
import { useWebSocket } from "./contexts/WebSocketContext";
import { Channel, MessageType } from "../../shared/types/websocket";
import { Avatar } from "../../shared/types/player";
import { Color } from "../../shared/types/player";

export default function Buzzer() {
  const { publish } = useWebSocket();

  const handlePress = () => {
    console.log("pressed");
    publish({
      channel: Channel.BUZZER,
      messageType: MessageType.BUZZ,
      payload: {
        player: {
          name: "TEST",
          color: Color.Red,
          avatar: Avatar.Icecream,
        },
      },
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen relative overflow-hidden">
      <PastelBackground />
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
