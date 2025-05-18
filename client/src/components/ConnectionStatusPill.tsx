import { ReadyState } from "react-use-websocket";

import { useWebSocketContext } from "../contexts/WebSocketContext";

export default function ConnectionStatusPill() {
  const { readyState } = useWebSocketContext();
  let text, color, opacity;

  switch (readyState) {
    case ReadyState.OPEN:
      text = "CONNECTED";
      color = "bg-green-500";
      opacity = "0.3";
      break;
    case ReadyState.CONNECTING:
      text = "CONNECTING";
      color = "bg-yellow-500";
      opacity = "0.6";
      break;
    default:
      text = "DISCONNECTED";
      color = "bg-red-500";
      opacity = "0.6";
      break;
  }

  return (
    <div
      className="absolute top-0 right-0 mt-3 mr-3 text-gray-800 font-bold px-3 py-1.5 rounded-full shadow-sm inline-flex items-center"
      style={{
        backgroundColor: `rgba(255,255,255,${opacity})`,
        fontSize: "10px",
      }}
    >
      <span
        className={`w-2 h-2 rounded-full mr-2 align-middle opacity-90 ${color}`}
      ></span>
      <span className="text-gray-800">{text}</span>
    </div>
  );
}
