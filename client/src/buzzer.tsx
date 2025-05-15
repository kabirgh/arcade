import "./buzzer.css";
import PastelBackground from "./components/PastelBackground";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { Channel, MessageType } from "../../shared/types/websocket";
import { Avatar } from "../../shared/types/player";
import { Color } from "../../shared/types/player";
import { ReadyState } from "react-use-websocket";

const ConnectionStatus = ({ readyState }: { readyState: ReadyState }) => {
  const statusText =
    readyState === ReadyState.OPEN
      ? "CONNECTED"
      : readyState === ReadyState.CONNECTING
      ? "CONNECTING"
      : "DISCONNECTED";

  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 mt-4 bg-[rgba(255,255,255,0.7)] text-gray-800 text-xs font-bold px-4 py-2 rounded-full shadow-md inline-flex items-center">
      <span
        className={`w-3 h-3 rounded-full mr-2 align-middle ${
          readyState === ReadyState.OPEN ? "bg-green-500" : "bg-red-500"
        }`}
      ></span>
      {statusText}
    </div>
  );
};

export default function Buzzer() {
  const { publish, readyState } = useWebSocketContext();

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
      <ConnectionStatus readyState={readyState} />
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
