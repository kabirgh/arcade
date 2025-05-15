import { ReadyState } from "react-use-websocket";

type ConnectionStatusPillProps = {
  readyState: ReadyState;
};

export default function ConnectionStatusPill({
  readyState,
}: ConnectionStatusPillProps) {
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
      className="absolute top-0 right-0 mt-3 mr-3 text-gray-800 font-bold px-3 py-1.5 rounded-full shadow-md inline-flex items-center"
      style={{
        backgroundColor: `rgba(255,255,255,${opacity})`,
        fontSize: "10px",
      }}
    >
      <span
        className={`w-2 h-2 rounded-full mr-2 align-middle ${color}`}
      ></span>
      {text}
    </div>
  );
}
