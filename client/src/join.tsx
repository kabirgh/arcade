import { useState, useEffect } from "react";
import { Color } from "../../shared/types/player";

type AvatarOption = {
  name: string;
  path: string;
};

const AVATAR_OPTIONS: AvatarOption[] = [
  "icecream",
  "bulb",
  "asparagus",
  "barrel",
  "book",
  "bottle",
  "cap",
  "carrot",
  "apple",
  "chimney",
  "cloud",
  "hourglass",
  "kite",
  "mug",
  "candle",
  "stopwatch",
  "puzzle",
  "rocket",
  "pillow",
  "spikyball",
  "palette",
  "tree",
  "umbrella",
  "world",
].map((name) => ({
  name,
  path: `/avatars/${name}.png`,
}));

export default function JoinScreen() {
  const [playerName, setPlayerName] = useState("");
  const [teamColor, setTeamColor] = useState<Color | null>(null);
  const [avatarName, setAvatarName] = useState<string | null>(null);
  const [isJoinEnabled, setIsJoinEnabled] = useState(false);

  useEffect(() => {
    // Enable join button when both name and avatar are selected
    setIsJoinEnabled(
      playerName.trim().length > 0 && avatarName !== null && teamColor !== null
    );
  }, [playerName, avatarName, teamColor]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayerName(e.target.value.toUpperCase());
  };

  const handleAvatarSelect = (avatar: string) => {
    setAvatarName(avatar);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isJoinEnabled) {
      // Handle join logic here
      console.log("Player joined:", {
        name: playerName,
        avatar: avatarName,
      });
      // TODO: Add API call to join the game
    }
  };

  return (
    <div className="h-screen">
      <div className="bg-white text-gray-900 flex flex-col h-full max-w-[400px] p-6 mx-auto">
        {/* Name Input */}
        <div className="mb-4">
          <p className="text-left text-md font-bold mb-1">NAME</p>
          <input
            id="playerName"
            value={playerName}
            onChange={handleNameChange}
            placeholder="Enter your name"
            maxLength={12}
            className="w-full p-2 text-md bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-200"
            autoFocus
          />
        </div>

        {/* Team color picker */}
        <div className="mb-4">
          <p className="text-left text-md font-bold mb-1">TEAM</p>
          <div className="flex flex-row justify-center items-center gap-4">
            <div
              className="w-10 h-10 rounded-full cursor-pointer"
              style={{
                backgroundColor: Color.Red,
                outline:
                  teamColor === Color.Red
                    ? "4px solid var(--color-gray-900)"
                    : "",
              }}
              onClick={() => setTeamColor(Color.Red)}
            ></div>
            <div
              className="w-10 h-10 rounded-full cursor-pointer"
              style={{
                backgroundColor: Color.Blue,
                outline:
                  teamColor === Color.Blue
                    ? "4px solid var(--color-gray-900)"
                    : "",
              }}
              onClick={() => setTeamColor(Color.Blue)}
            ></div>
            <div
              className="w-10 h-10 rounded-full cursor-pointer"
              style={{
                backgroundColor: Color.Green,
                outline:
                  teamColor === Color.Green
                    ? "4px solid var(--color-gray-900)"
                    : "",
              }}
              onClick={() => setTeamColor(Color.Green)}
            ></div>
            <div
              className="w-10 h-10 rounded-full cursor-pointer"
              style={{
                backgroundColor: Color.Yellow,
                outline:
                  teamColor === Color.Yellow
                    ? "4px solid var(--color-gray-900)"
                    : "",
              }}
              onClick={() => setTeamColor(Color.Yellow)}
            ></div>
          </div>
        </div>

        {/* Avatar grid */}
        <p className="text-left text-md font-bold mb-1">AVATAR</p>
        {/* self-center switches the grid's cross‑axis alignment from stretch to center, so width is now "shrink‑to‑fit" and aspect-[2/3] can decide it. */}
        <div className="grid flex-1 self-center aspect-[2/3] grid-cols-4 grid-rows-6 gap-2 max-w-full">
          {AVATAR_OPTIONS.map((avatar) => (
            <div
              key={avatar.name}
              onClick={() => handleAvatarSelect(avatar.name)}
              className="p-1.5 aspect-square cursor-pointer rounded-lg"
              style={{
                backgroundColor:
                  avatarName === avatar.name ? "var(--color-stone-200)" : "",
              }}
            >
              <div
                style={{
                  backgroundImage: `url(${avatar.path})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  width: "100%",
                  height: "100%",
                }}
              ></div>
            </div>
          ))}
        </div>

        {/* Join Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={!isJoinEnabled}
            className={`mt-6 w-full py-3 text-xl font-bold rounded-lg transition-all
                   ${
                     isJoinEnabled
                       ? "bg-[#238551] text-white hover:bg-[#32A467] cursor-pointer"
                       : "bg-stone-300 text-stone-500 cursor-not-allowed"
                   }`}
          >
            JOIN
          </button>
        </div>
      </div>
    </div>
  );
}
