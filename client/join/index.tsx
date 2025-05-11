import { useState, useEffect } from "react";
import { Link } from "wouter";

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
      "apple",
      "asparagus",
      "barrel",
      "book",
      "bottle",
      "bulb",
      "candle",
      "cap",
      "carrot",
      "chimney",
      "cloud",
      "hourglass",
      "icecream",
      "kite",
      "mug",
      "palette",
      "pillow",
      "puzzle",
      "rocket",
      "spikyball",
      "stopwatch",
      "tree",
      "umbrella",
      "world",
    ];

    const options = avatars.map((name) => ({
      name,
      path: `../assets/avatars/${name}.png`,
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
    <div className="min-h-screen bg-indigo-800 text-white flex flex-col">
      {/* Header */}
      <header className="bg-indigo-900 p-4 text-center">
        <h1 className="text-3xl font-bold">Join Game</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 flex flex-col">
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          {/* Name Input */}
          <div className="mb-6">
            <label
              htmlFor="playerName"
              className="block text-lg font-medium mb-2"
            >
              ENTER YOUR NAME:
            </label>
            <input
              type="text"
              id="playerName"
              value={playerName}
              onChange={handleNameChange}
              maxLength={12}
              placeholder="TYPE NAME HERE"
              className="w-full p-4 text-xl text-center bg-indigo-600 border-2 border-indigo-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent placeholder-indigo-300"
              autoFocus
            />
          </div>

          {/* Avatar Selection */}
          <div className="flex-1">
            <h2 className="text-lg font-medium mb-2">CHOOSE YOUR AVATAR:</h2>
            <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
              {avatarOptions.map((avatar) => (
                <button
                  key={avatar.name}
                  type="button"
                  onClick={() => handleAvatarSelect(avatar.name)}
                  className={`aspect-square p-2 rounded-lg ${
                    selectedAvatar === avatar.name
                      ? "bg-yellow-400 ring-4 ring-white"
                      : "bg-indigo-700 hover:bg-indigo-600"
                  }`}
                >
                  <img
                    src={avatar.path}
                    alt={avatar.name}
                    className="w-full h-full object-contain"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Join Button */}
          <div className="mt-6">
            <button
              type="submit"
              disabled={!isJoinEnabled}
              className={`w-full py-3 text-xl font-bold rounded-lg transition-all ${
                isJoinEnabled
                  ? "bg-yellow-400 text-indigo-900 hover:bg-yellow-300"
                  : "bg-indigo-700 text-indigo-300 cursor-not-allowed"
              }`}
            >
              JOIN
            </button>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="bg-indigo-900 p-4 text-center">
        <Link href="/" className="text-yellow-400 hover:text-yellow-300">
          Back to Home
        </Link>
      </footer>
    </div>
  );
}
