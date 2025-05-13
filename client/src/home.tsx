import { useEffect, useState } from "react";
import { Color, type Player } from "../../shared/types/player";
import {
  Channel,
  MessageType,
  type WebSocketMessage,
} from "../../shared/types/websocket";
import PastelBackground from "./components/PastelBackground";
import { useWebSocket } from "./contexts/WebSocketContext";

type TeamSectionProps = {
  name: string;
  color: Color;
  players: Player[];
};

const TeamSection = ({ name, color }: TeamSectionProps) => {
  // TODO: Add player avatars to the team section
  return (
    <div className="flex flex-col justify-center w-[300px] h-full">
      <p className="text-lg font-bold mb-1 text-left">{name}</p>
      <div
        className="w-full h-[220px]"
        style={{ border: `8px solid ${color}` }}
      ></div>
    </div>
  );
};

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    subscribe(Channel.PLAYER, (message: WebSocketMessage) => {
      if (message.messageType === MessageType.ALL_PLAYERS) {
        setPlayers((prevPlayers) => {
          const allPlayers = [...prevPlayers, ...message.payload];
          return [...new Set(allPlayers)];
        });
      }
    });

    return () => unsubscribe(Channel.PLAYER);
  }, [subscribe, unsubscribe]);

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Parent needs to be relative to keep the pastel background in view */}
      <PastelBackground animate />
      <div
        className="grid w-full h-full"
        style={{
          gridTemplateAreas: `
          "left center right last"
          "left center right last"
      `,
          gridTemplateColumns: "40% auto auto 5%",
          gridTemplateRows: "50% auto",
        }}
      >
        {/* QR codes */}
        <div
          className="flex flex-col items-center justify-evenly w-full h-full"
          style={{ gridArea: "left" }}
        >
          <div className="flex flex-col items-center justify-center w-[300px]">
            <img src="/qr-wifi.png" width="200px" height="auto" />
            <p className="text-md mt-3 text-center">
              1. Connect to the wifi network
            </p>
          </div>
          <div className="flex flex-col items-center justify-center w-[300px]">
            <img src="/qr-joinurl.png" width="200px" height="auto" />
            <p className="text-md mt-3 text-center">2. Join the game</p>
          </div>
        </div>

        {/* Team sections */}
        <div
          className="flex flex-col justify-evenly items-center"
          style={{ gridArea: "center" }}
        >
          <TeamSection name="Team 1" color={Color.Red} players={players} />
          <TeamSection name="Team 2" color={Color.Blue} players={players} />
        </div>
        <div
          className="flex flex-col justify-around items-center"
          style={{ gridArea: "right" }}
        >
          <TeamSection name="Team 3" color={Color.Green} players={players} />
          <TeamSection name="Team 4" color={Color.Yellow} players={players} />
        </div>
      </div>
    </div>
  );
}
