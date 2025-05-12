import { Color } from "../../shared/types/player";
import PastelBackground from "./components/PastelBackground";

const TeamSection = ({ name, color }: { name: string; color: Color }) => {
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

export default function Lobby() {
  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Parent needs to be relative to keep the pastel background in view */}
      <PastelBackground />
      <div
        className="grid w-full h-full"
        style={{
          gridTemplateAreas: `
          "nav nav nav"
          "left center right"
          "left center right"
      `,
          gridTemplateColumns: "40% auto auto",
          gridTemplateRows: "1fr 4.5fr 4.5fr",
        }}
      >
        {/* Nav */}
        <div
          className="flex flex-col items-center justify-center w-full h-full"
          style={{
            gridArea: "nav",
            /* From https://css.glass */
            background: "rgba(255, 255, 255, 0.2)",
            boxShadow: "0 2px 15px rgba(0, 0, 0, 0.05)",
            backdropFilter: "blur(5px)",
            WebkitBackdropFilter: "blur(5px)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
          }}
        >
          <div className="flex flex-row items-center justify-evenly w-[600px] h-full">
            <p>BUZZER</p>
            <p>GAMES</p>
          </div>
        </div>

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
          <TeamSection name="Team 1" color={Color.Red} />
          <TeamSection name="Team 2" color={Color.Blue} />
        </div>
        <div
          className="flex flex-col justify-around items-center"
          style={{ gridArea: "right" }}
        >
          <TeamSection name="Team 3" color={Color.Green} />
          <TeamSection name="Team 4" color={Color.Yellow} />
        </div>
      </div>
    </div>
  );
}
