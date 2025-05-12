import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import type { Player } from "../../shared/types/player";
import { Color, Avatar } from "../../shared/types/player";
import { useWebSocket } from "./contexts/WebSocketContext";
import { Channel } from "../../shared/types/websocket";
import { avatarToPath } from "../../shared/utils";
import PastelBackground from "./components/PastelBackground";

const TeamCircle = ({
  color,
  teamColor,
  onClick,
}: {
  color: Color;
  teamColor: Color | null;
  onClick: () => void;
}) => {
  return (
    <div
      className="w-10 h-10 rounded-full cursor-pointer"
      style={{
        backgroundColor: color,
        outline: teamColor === color ? "4px solid var(--color-gray-900)" : "",
      }}
      onClick={onClick}
    ></div>
  );
};

export default function JoinScreen() {
  const [playerName, setPlayerName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [teamColor, setTeamColor] = useState<Color | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [isJoinEnabled, setIsJoinEnabled] = useState(false);
  const [existingPlayers, setExistingPlayers] = useState<Player[]>([
    { name: "NAME", color: Color.Red, avatar: Avatar.World },
  ]);
  const [isConnected, setIsConnected] = useState(false);
  const [, setLocation] = useLocation();
  const {
    subscribe,
    unsubscribe,
    publish,
    status: connectionStatus,
  } = useWebSocket();

  // Subscribe to taken player name and avatar updates
  useEffect(() => {
    subscribe(Channel.PLAYER, (payload: Player[]) => {
      setExistingPlayers((prevPlayers) => {
        const allPlayers = [...prevPlayers, ...payload];
        return [...new Set(allPlayers)];
      });
    });

    return () => unsubscribe(Channel.PLAYER);
  }, [subscribe, unsubscribe]);

  // If an existing player has the same avatar is this player, deselect the avatar
  useEffect(() => {
    if (existingPlayers.some((player) => player.avatar === selectedAvatar)) {
      setSelectedAvatar(null);
    }
  }, [existingPlayers, selectedAvatar]);

  // Enable join button when name, team color, and avatar are selected and there are no errors
  useEffect(() => {
    setIsJoinEnabled(
      playerName.trim().length > 0 &&
        selectedAvatar !== null &&
        teamColor !== null &&
        nameError === null
    );
  }, [playerName, selectedAvatar, teamColor, nameError]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value.toUpperCase();
    if (existingPlayers.some((player) => player.name === name)) {
      setNameError("This name has been taken by another player");
    } else {
      setNameError(null);
    }
    setPlayerName(name);
  };

  const handleAvatarSelect = (avatar: Avatar) => {
    // If this avatar is already taken, don't select it
    if (existingPlayers.some((player) => player.avatar === avatar)) {
      return;
    }
    // Select new avatar
    setSelectedAvatar(avatar);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (playerName.trim().length < 1) {
      setNameError("Your name must be at least 1 character");
      return;
    }
    if (playerName.trim().length > 12) {
      setNameError("Your name must be 12 characters or less");
      return;
    }

    if (isJoinEnabled && selectedAvatar && teamColor) {
      const player: Player = {
        name: playerName,
        color: teamColor,
        avatar: selectedAvatar,
      };

      // Store player info in localStorage
      localStorage.setItem("player", JSON.stringify(player));

      // Send join message with permanent avatar selection
      publish(Channel.PLAYER, {
        type: "join",
        player,
      });

      // Navigate to lobby screen
      setLocation("/buzzer");
    }
  };

  useEffect(() => {
    setIsConnected(connectionStatus === "connected");
  }, [connectionStatus]);

  return (
    <div className="h-screen relative overflow-hidden">
      <PastelBackground />
      <div className="text-gray-900 flex flex-col h-full max-w-[400px] p-6 mx-auto">
        {/* Name Input */}
        <div className="mb-4">
          <p className="text-left text-md font-bold mb-1">NAME</p>
          <input
            id="playerName"
            value={playerName}
            onChange={handleNameChange}
            placeholder="Enter your name"
            maxLength={12}
            autoFocus
            autoComplete="off"
            data-1p-ignore="true"
            className={`w-full p-2 text-md bg-gray-50 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${
              nameError ? "ring-red-300" : "focus:ring-sky-200"
            }`}
          />
          <div className="text-left mt-1">
            {nameError && <p className="text-red-500 text-xs">{nameError}</p>}
          </div>
        </div>

        {/* Team color picker */}
        <div className="mb-4">
          <p className="text-left text-md font-bold mb-1">TEAM</p>
          <div className="flex flex-row justify-center items-center gap-4">
            <TeamCircle
              color={Color.Red}
              teamColor={teamColor}
              onClick={() => setTeamColor(Color.Red)}
            />
            <TeamCircle
              color={Color.Blue}
              teamColor={teamColor}
              onClick={() => setTeamColor(Color.Blue)}
            />
            <TeamCircle
              color={Color.Green}
              teamColor={teamColor}
              onClick={() => setTeamColor(Color.Green)}
            />
            <TeamCircle
              color={Color.Yellow}
              teamColor={teamColor}
              onClick={() => setTeamColor(Color.Yellow)}
            />
          </div>
        </div>

        {/* Avatar grid */}
        <p className="text-left text-md font-bold mb-1">AVATAR</p>
        {/* self-center switches the grid's cross‑axis alignment from stretch to center, so width is now "shrink‑to‑fit" and aspect-[2/3] can decide it. */}
        <div className="grid flex-1 self-center aspect-[2/3] grid-cols-4 grid-rows-6 gap-2 max-w-full">
          {Object.values(Avatar).map((avatar) => {
            const isTaken = existingPlayers.some(
              (player) => player.avatar === avatar
            );
            return (
              <div
                key={avatar}
                onClick={() => !isTaken && handleAvatarSelect(avatar)}
                className={`p-1.5 aspect-square rounded-lg ${
                  isTaken ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                }`}
                style={{
                  backgroundColor: selectedAvatar === avatar ? "white" : "",
                }}
              >
                <div
                  style={{
                    backgroundImage: `url(${avatarToPath(avatar)})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    width: "100%",
                    height: "100%",
                  }}
                ></div>
              </div>
            );
          })}
        </div>

        {/* Join Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={!isJoinEnabled || !isConnected}
            className={`mt-6 w-full py-3 text-xl font-bold rounded-lg transition-all
                   ${
                     isJoinEnabled && isConnected
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
