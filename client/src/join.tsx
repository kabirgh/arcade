import { useEffect, useState } from "react";
import { ReadyState } from "react-use-websocket";
import { toast, Toaster } from "sonner";
import { useLocation } from "wouter";

import { APIRoute } from "../../shared/types/api/schema";
import type { WebSocketMessage } from "../../shared/types/api/websocket";
import type { Player, Team } from "../../shared/types/domain/player";
import { Avatar } from "../../shared/types/domain/player";
import { Channel, MessageType } from "../../shared/types/domain/websocket";
import { avatarToPath, generateId } from "../../shared/utils";
import PastelBackground from "./components/PastelBackground";
import { usePlayerContext } from "./contexts/PlayerContext";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { apiFetch } from "./util/apiFetch";

const TeamCircle = ({
  team,
  selectedTeam,
  onClick,
}: {
  team: Team;
  selectedTeam: Team | null;
  onClick: () => void;
}) => {
  return (
    <div
      className="w-9 h-9 rounded-full cursor-pointer"
      style={{
        backgroundColor: team.color,
        boxShadow:
          team.name === selectedTeam?.name
            ? "0 0 0 4px var(--color-white)"
            : "",
        transform: team.name === selectedTeam?.name ? "scale(1.2)" : "scale(1)",
      }}
      onClick={onClick}
    ></div>
  );
};

export default function JoinScreen() {
  const [, setLocation] = useLocation();
  const { subscribe, readyState } = useWebSocketContext();
  const { sessionPlayer, setSessionPlayer } = usePlayerContext();
  const [playerName, setPlayerName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [isJoinEnabled, setIsJoinEnabled] = useState(false);
  const [existingPlayers, setExistingPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    // Check if the user was interrupted in the middle of filling out the join form.
    // If so, fill in the form with the player's last-used values. If not, the form will be blank.
    const storedJoinInfo = localStorage.getItem("playerJoinInfo");
    if (storedJoinInfo) {
      try {
        const joinInfo = JSON.parse(storedJoinInfo);
        // Only set state if the loaded value is not null/undefined
        if (joinInfo.name) setPlayerName(joinInfo.name);
        if (joinInfo.team) setSelectedTeam(joinInfo.team);
        if (joinInfo.avatar) setSelectedAvatar(joinInfo.avatar);
      } catch (error) {
        console.error(
          "Failed to parse player join info from localStorage",
          error
        );
        localStorage.removeItem("playerJoinInfo"); // Clear invalid item
      }
    }

    // Another use effect will redirect to the correct screen
  }, []);

  useEffect(() => {
    // First check what the server thinks the current screen should be
    apiFetch(APIRoute.PlayerScreen).then((data) => {
      if (sessionPlayer !== null) {
        // We have a user in sessionPlayer, and so shouldn't be on the join screen.
        // Redirect to the correct screen immediately
        setLocation(data.screen);
      }
    });
  }, [sessionPlayer, setLocation]);

  useEffect(() => {
    // Get existing players from server
    apiFetch(APIRoute.ListPlayers)
      .then((data) => {
        setExistingPlayers(data.players);
      })
      .catch((error) => {
        console.error("Failed to load players:", error);
        toast.error("Failed to load players. Please refresh the page.", {
          closeButton: true,
          position: "top-center",
        });
      });
    // Get existing teams from server
    apiFetch(APIRoute.ListTeams)
      .then((data) => {
        setTeams(data.teams);
      })
      .catch((error) => {
        console.error("Failed to load teams:", error);
        toast.error("Failed to load teams. Please refresh the page.", {
          closeButton: true,
          position: "top-center",
        });
      });
  }, []);

  // Save draft join info to localStorage whenever it changes
  useEffect(() => {
    const currentJoinInfo = {
      name: playerName,
      team: selectedTeam,
      avatar: selectedAvatar,
    };

    // Don't save if all fields are initial/empty to avoid cluttering localStorage
    if (playerName || selectedTeam || selectedAvatar) {
      localStorage.setItem("playerJoinInfo", JSON.stringify(currentJoinInfo));
    }
  }, [playerName, selectedTeam, selectedAvatar]);

  // Subscribe to taken player updates
  useEffect(() => {
    const unsubscribe = subscribe(
      Channel.PLAYER,
      (message: WebSocketMessage) => {
        console.log("Received message on player channel:", message);
        if (message.messageType === MessageType.LIST) {
          console.log("Updating existing players:", message.payload);
          setExistingPlayers(message.payload);
        }
      }
    );

    return unsubscribe;
  }, [subscribe]);

  // If the selected avatar is taken by another player, deselect it.
  useEffect(() => {
    if (sessionPlayer !== null || selectedAvatar === null) return; // Skip after joining

    const avatarIsTakenByOther = existingPlayers.some(
      (player) => player.avatar === selectedAvatar
    );

    if (avatarIsTakenByOther) {
      console.log("Avatar is taken by other:", avatarIsTakenByOther);
      setSelectedAvatar(null);
    }
  }, [existingPlayers, selectedAvatar, sessionPlayer]);

  // Enable join button when name, team color, and avatar are selected and there are no errors
  useEffect(() => {
    setIsJoinEnabled(
      playerName.trim().length > 0 &&
        selectedAvatar !== null &&
        selectedTeam !== null &&
        nameError === null
    );
  }, [playerName, selectedAvatar, selectedTeam, nameError]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayerName(e.target.value.toUpperCase());
    // nameError will be updated by the useEffect below
  };

  // Validate playerName against existingPlayers
  useEffect(() => {
    // Skip validation once the player has already joined to avoid a brief flash of "invalid"
    if (sessionPlayer !== null) return;

    if (playerName.trim().length === 0) {
      setNameError(null); // No error if name is empty
      return;
    }

    const conflictingPlayerEntry = existingPlayers.find(
      (p) => p.name === playerName
    );

    if (conflictingPlayerEntry) {
      // Name found in existingPlayers
      setNameError("This name has been taken by another player");
    } else {
      // Name not found in existingPlayers
      setNameError(null);
    }
  }, [playerName, existingPlayers, sessionPlayer]);

  const handleAvatarSelect = (avatar: Avatar) => {
    // If this avatar is already taken, don't select it
    if (existingPlayers.some((player) => player.avatar === avatar)) {
      return;
    }
    // Select new avatar
    setSelectedAvatar(avatar);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (playerName.trim().length < 1) {
      setNameError("Your name must be at least 1 character");
      return;
    }
    if (playerName.trim().length > 12) {
      setNameError("Your name must be 12 characters or less");
      return;
    }

    if (!isJoinEnabled || !selectedAvatar || !selectedTeam) {
      toast.error("Not all fields are complete", {
        closeButton: true,
        position: "top-center",
      });
      return;
    }

    // Validate player
    const response = await apiFetch(APIRoute.ValidatePlayerJoin, {
      name: playerName,
      avatar: selectedAvatar,
    });
    if (!response.valid) {
      toast.error(response.errorMessage, {
        closeButton: true,
        position: "top-center",
      });
      // This shouldn't be possible since we listen to player updates...
      return;
    }

    const player: Player = {
      id: generateId("player", 6),
      name: playerName,
      teamId: selectedTeam.id,
      avatar: selectedAvatar,
    };

    // Clear the draft join info from localStorage
    localStorage.removeItem("playerJoinInfo");
    // Use context to set the player state and persist it. Also sends a JOIN message to the server.
    setSessionPlayer(player);

    // After player is set, another use effect will redirect to the correct screen
  };

  return (
    <div className="h-screen relative overflow-hidden">
      <Toaster />
      <PastelBackground />
      <div className="text-gray-900 flex flex-col h-full max-w-[400px] p-6 mx-auto overflow-y-auto">
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
            className={`w-full p-2 text-md bg-gray-50 border-1 border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${
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
            {teams.map((team) => (
              <TeamCircle
                key={team.name}
                team={team}
                selectedTeam={selectedTeam}
                onClick={() => setSelectedTeam(team)}
              />
            ))}
          </div>
        </div>

        {/* Avatar grid */}
        <p className="text-left text-md font-bold mb-1">AVATAR</p>
        {/* self-center switches the grid's cross‑axis alignment from stretch to center, so width is now "shrink‑to‑fit" and aspect-[2/3] can decide it. */}
        <div className="grid flex-1 self-center aspect-[2/3] grid-cols-4 grid-rows-6 gap-2 max-w-full min-h-0">
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
            disabled={!isJoinEnabled || readyState !== ReadyState.OPEN}
            className={`mt-3 mb-10 w-full py-2 text-xl font-bold rounded-lg transition-all
                   ${
                     isJoinEnabled && readyState === ReadyState.OPEN
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
