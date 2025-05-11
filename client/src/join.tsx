import { useState, useEffect } from "react";

interface AvatarOption {
  name: string;
  path: string;
}

export default function JoinScreen() {
  const [playerName, setPlayerName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [avatarOptions, setAvatarOptions] = useState<AvatarOption[]>([]);
  const [isJoinEnabled, setIsJoinEnabled] = useState(false);

  useEffect(() => {
    // List of avatar files
    const avatars = [
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
    ];

    const options = avatars.map((name) => ({
      name,
      path: `/avatars/${name}.png`,
    }));

    setAvatarOptions(options);
  }, []);

  useEffect(() => {
    // Enable join button when both name and avatar are selected
    setIsJoinEnabled(playerName.trim().length > 0 && selectedAvatar !== null);
  }, [playerName, selectedAvatar]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayerName(e.target.value);
  };

  const handleAvatarSelect = (avatar: string) => {
    setSelectedAvatar(avatar);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isJoinEnabled) {
      // Handle join logic here
      console.log("Player joined:", {
        name: playerName,
        avatar: selectedAvatar,
      });
      // TODO: Add API call to join the game
    }
  };

  return (
    <div className="h-screen bg-white text-gray-900 flex flex-col max-w-screen-sm mx-auto">
      {/* Name Input */}
      <div className="mb-6">
        <input
          type="text"
          id="playerName"
          value={playerName}
          onChange={handleNameChange}
          maxLength={12}
          placeholder="TYPE NAME HERE"
          className="w-full p-4 text-xl text-center text-gray-900 bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent placeholder-gray-400"
          autoFocus
        />
      </div>

      {/* Avatar Selection */}

      <div className="grid grid-cols-4 grid-rows-6 gap-2 h-screen overflow-hidden">
        {avatarOptions.map((avatar) => (
          <div
            className="flex items-center justify-center cursor-pointer"
            onClick={() => handleAvatarSelect(avatar.name)}
            style={{
              border:
                selectedAvatar === avatar.name
                  ? "2px solid #FFD700"
                  : "2px solid transparent",
            }}
          >
            <img
              src={avatar.path}
              alt={avatar.name}
              className="w-full h-full object-contain"
            />
          </div>
        ))}
      </div>

      {/* Join Button */}
      <div className="mt-6">
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={!isJoinEnabled}
          className={`cursor-pointer w-full py-3 text-xl font-bold rounded-lg transition-all ${
            isJoinEnabled
              ? "bg-yellow-400 text-black hover:bg-yellow-300"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          JOIN
        </button>
      </div>
    </div>
  );
}
