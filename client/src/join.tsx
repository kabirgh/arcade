import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import type { Player } from "../../shared/types/player";
import { Color, Avatar } from "../../shared/types/player";
import { useWebSocket } from "./contexts/WebSocketContext";
import { usePlayer } from "./contexts/PlayerContext";
import {
  Channel,
  MessageType,
  type WebSocketMessage,
} from "../../shared/types/websocket";
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
      className="w-9 h-9 rounded-full cursor-pointer"
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
  const [existingPlayers, setExistingPlayers] = useState<Player[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [, setLocation] = useLocation();
  const {
    subscribe,
    unsubscribe,
    publish,
    status: connectionStatus,
  } = useWebSocket();
  const { setLoggedInPlayer } = usePlayer();

  // Load draft join info from localStorage on mount
  useEffect(() => {
    const storedJoinInfo = localStorage.getItem("playerJoinInfo");
    if (storedJoinInfo) {
      try {
        const joinInfo = JSON.parse(storedJoinInfo);
        // Only set state if the loaded value is not null/undefined
        if (joinInfo.name) setPlayerName(joinInfo.name);
        if (joinInfo.color) setTeamColor(joinInfo.color);
        if (joinInfo.avatar) setSelectedAvatar(joinInfo.avatar);
      } catch (error) {
        console.error(
          "Failed to parse player join info from localStorage",
          error
        );
        localStorage.removeItem("playerJoinInfo"); // Clear invalid item
      }
    }
  }, []); // Run only once on mount

  // Get existing players from server
  useEffect(() => {
    fetch("/players")
      .then((res) => res.json())
      .then((data) => {
        console.log("Initial mount existing players:", data);
        setExistingPlayers(data);
      });
  }, []);

  // Save draft join info to localStorage whenever it changes
  useEffect(() => {
    const currentJoinInfo = {
      name: playerName,
      color: teamColor,
      avatar: selectedAvatar,
    };
    // Don't save if all fields are initial/empty to avoid cluttering localStorage
    if (playerName || teamColor || selectedAvatar) {
      localStorage.setItem("playerJoinInfo", JSON.stringify(currentJoinInfo));
    } else {
      // If all fields are empty/null, ensure we remove any stale draft
      localStorage.removeItem("playerJoinInfo");
    }
  }, [playerName, teamColor, selectedAvatar]);

  // Subscribe to taken player updates
  useEffect(() => {
    subscribe(Channel.PLAYER, (message: WebSocketMessage) => {
      console.log("Received message on player channel:", message);
      if (message.messageType === MessageType.ALL_PLAYERS) {
        console.log("Updating existing players:", message.payload);
        setExistingPlayers(message.payload);
      }
    });

    return () => unsubscribe(Channel.PLAYER);
  }, [subscribe, unsubscribe]);

  // If the selected avatar is taken by another player, deselect it.
  useEffect(() => {
    if (selectedAvatar === null) return; // No avatar selected, nothing to do

    const avatarIsTakenByOther = existingPlayers.some(
      (player) => player.avatar === selectedAvatar && player.name !== playerName
    );
    console.log("Avatar is taken by other:", avatarIsTakenByOther);

    if (avatarIsTakenByOther) {
      setSelectedAvatar(null);
      // Also clear the draft avatar from localStorage if deselected due to conflict
      const storedJoinInfo = localStorage.getItem("playerJoinInfo");
      if (storedJoinInfo) {
        try {
          const joinInfo = JSON.parse(storedJoinInfo);
          if (joinInfo.avatar === selectedAvatar) {
            // Check if the stored one matches the one causing conflict
            localStorage.setItem(
              "playerJoinInfo",
              JSON.stringify({ ...joinInfo, avatar: null })
            );
          }
        } catch (error) {
          console.error("Failed to update draft avatar in localStorage", error);
        }
      }
    }
  }, [existingPlayers, selectedAvatar, playerName]);

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
    setPlayerName(name);
    // nameError will be updated by the useEffect below
  };

  // Validate playerName against existingPlayers, considering selectedAvatar
  useEffect(() => {
    if (playerName.trim().length === 0) {
      setNameError(null); // No error if name is empty
      return;
    }

    const conflictingPlayerEntry = existingPlayers.find(
      (p) => p.name === playerName
    );

    if (conflictingPlayerEntry) {
      // Name found in existingPlayers
      // If this name is tied to an avatar, and that avatar is NOT our selectedAvatar, then it's a name conflict.
      if (conflictingPlayerEntry.avatar !== selectedAvatar) {
        setNameError("This name has been taken by another player");
      } else {
        // Name matches, avatar matches. This is "our" spot (or someone identical). No error for name input.
        setNameError(null);
      }
    } else {
      // Name not found in existingPlayers
      setNameError(null);
    }
  }, [playerName, existingPlayers, selectedAvatar]);

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

      // Use context to set the player state and persist it. Also sends a JOIN message to the server.
      setLoggedInPlayer(player);

      // Clear the draft join info from localStorage
      localStorage.removeItem("playerJoinInfo");

      // Set confirmed player information in localStorage so page reloads can redirect to the correct screen
      // localStorage.setItem("playerInfo", JSON.stringify(player));
      // TODO:
      // - On page load:
      //   - Check if playerInfo is set in localStorage. If not, stay on the
      //     join screen.
      //   - If yes, ask server what the current screen should be. eg. buzzer,
      //     joystick for games. Navigate to the correct screen.
      //   - If the server doesn't know, this means its a new game. Delete the
      //     playerInfo from localStorage and stay on the join screen. Currently
      //     playerInfo will be persisted forever.
      //
      // Other multiplayer games like jackbox handle this with rooms/sessions,
      // which I don't want to implement for this project.

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
            className={`mt-3 mb-10 w-full py-2 text-xl font-bold rounded-lg transition-all
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
