import { useEffect, useState } from "react";

import { APIRoute } from "../../shared/types/api/schema";
import type { WebSocketMessage } from "../../shared/types/api/websocket";
import {
  Color,
  type Player,
  type Team,
} from "../../shared/types/domain/player";
import { Channel, MessageType } from "../../shared/types/domain/websocket";
import { avatarToPath } from "../../shared/utils";
import PastelBackground from "./components/PastelBackground";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { useAdminAuth } from "./hooks/useAdminAuth";
import { useListenNavigate } from "./hooks/useListenNavigate";
import { apiFetch } from "./util/apiFetch";

type TeamSectionProps = {
  team: Team;
  onTeamNameConfirm: (name: string) => void;
  players: Player[];
  buzzingPlayers: Set<string>;
};

const TeamSection = ({
  team,
  onTeamNameConfirm,
  players,
  buzzingPlayers,
}: TeamSectionProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editableName, setEditableName] = useState(team.name);

  useEffect(() => {
    if (!isEditing) {
      setEditableName(team.name);
    }
  }, [team.name, isEditing]);

  const handleConfirm = () => {
    onTeamNameConfirm(editableName);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  // Filter players for this specific team
  const teamPlayers = players.filter((player) => player.teamId === team.id);

  return (
    <div className="flex flex-col justify-center w-[85%] h-full">
      <div
        className="w-full h-[85%] flex flex-wrap items-center justify-center gap-2 p-4 shadow-md"
        style={{ border: `8px solid ${team.color}` }}
      >
        {teamPlayers.map((player) => (
          <div key={player.id} className="flex flex-col items-center">
            <img
              src={avatarToPath(player.avatar)}
              alt={`${player.name}'s avatar`}
              className="w-[64px] h-[64px] object-cover"
              style={{
                animation: buzzingPlayers.has(player.id)
                  ? "hop 0.1s ease-out"
                  : undefined,
              }}
            />
            <span className="text-xs font-medium mt-1 text-center w-[144px]">
              {player.name}
            </span>
          </div>
        ))}
        {teamPlayers.length === 0 && (
          <div className="text-gray-400 text-center">No players here</div>
        )}
      </div>
      <div className="flex items-center mt-2">
        <input
          type="text"
          className="w-full py-1.5"
          style={{
            backgroundColor: isEditing ? "white" : "transparent",
            borderRadius: isEditing ? "4px" : "0px",
            paddingLeft: isEditing ? "8px" : "0px",
            fontWeight: isEditing ? "normal" : "bold",
          }}
          value={editableName}
          onChange={(e) => setEditableName(e.target.value)}
          disabled={!isEditing}
        />
        <button
          onClick={isEditing ? handleConfirm : handleEdit}
          className="ml-2 px-2 py-1 bg-gray-50 rounded-md hover:bg-white cursor-pointer"
          aria-label={isEditing ? "Confirm name change" : "Edit name"}
        >
          {isEditing ? "✔️" : "✏️"}
        </button>
      </div>
    </div>
  );
};

// Add custom hop animation styles
const hopAnimationStyle = `
@keyframes hop {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
`;

export default function Home() {
  useListenNavigate("host");
  const { isAuthenticated } = useAdminAuth({ claimHost: true });
  const { subscribe } = useWebSocketContext();
  const [players, setPlayers] = useState<Player[]>([]);
  const [buzzingPlayers, setBuzzingPlayers] = useState<Set<string>>(new Set());
  const [teams, setTeams] = useState<Team[]>([
    // Default teams while we wait for the server to return the actual teams
    { id: "1", name: "", color: Color.Red },
    { id: "2", name: "", color: Color.Blue },
    { id: "3", name: "", color: Color.Green },
    { id: "4", name: "", color: Color.Yellow },
  ]);

  useEffect(() => {
    apiFetch(APIRoute.ListPlayers).then(({ players }) => {
      setPlayers(players);
    });
    apiFetch(APIRoute.ListTeams).then(({ teams }) => {
      setTeams(teams);
    });
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe(
      Channel.PLAYER,
      (message: WebSocketMessage) => {
        if (message.messageType === MessageType.LIST) {
          setPlayers(message.payload);
        }
      }
    );

    return unsubscribe;
  }, [subscribe]);

  useEffect(() => {
    const unsubscribe = subscribe(
      Channel.BUZZER,
      (message: WebSocketMessage) => {
        if (message.messageType === MessageType.BUZZ) {
          const { playerId } = message.payload;

          // Add player to buzzing set
          setBuzzingPlayers((prev) => new Set([...prev, playerId]));

          // Remove player from buzzing set after animation completes
          setTimeout(() => {
            setBuzzingPlayers((prev) => {
              const newSet = new Set(prev);
              newSet.delete(playerId);
              return newSet;
            });
          }, 300); // Animation duration
        }
      }
    );

    return unsubscribe;
  }, [subscribe]);

  const handleTeamNameChange = (teamId: string, name: string) => {
    apiFetch(APIRoute.SetTeamName, { teamId, name }).then(() => {
      setTeams((prevTeams) => {
        const newTeams = [...prevTeams];
        const team = newTeams.find((t) => t.id === teamId);
        if (team) {
          team.name = name;
        }
        return newTeams;
      });
    });
  };

  // Dynamic layout calculation based on number of teams
  const getTeamsGridLayout = (teamCount: number) => {
    switch (teamCount) {
      case 2:
        return {
          gridTemplateColumns: "1fr",
          gridTemplateRows: "1fr 1fr",
          maxWidth: "800px",
        };
      case 3:
        return {
          gridTemplateColumns: "1fr",
          gridTemplateRows: "1fr 1fr 1fr",
          maxWidth: "800px",
        };
      case 4:
      default:
        return {
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          maxWidth: "1000px",
        };
    }
  };

  const teamsGridStyle = getTeamsGridLayout(teams.length);

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Parent needs to be relative to keep the pastel background in view */}
      <style>{hopAnimationStyle}</style>
      <PastelBackground animate />
      {!isAuthenticated && (
        <div className="flex flex-col items-center justify-center w-full h-full">
          <h1 className="text-4xl font-bold">Access denied</h1>
        </div>
      )}
      {isAuthenticated && (
        <div className="flex w-full h-full">
          {/* QR codes */}
          <div className="flex flex-col items-center justify-evenly w-[35%] h-full">
            <div className="flex flex-col items-center justify-center w-[300px]">
              <img src="/qr-wifi.png" width="85%" height="auto" />
              <p className="text-lg mt-3 text-center">
                1. Connect to the wifi network
              </p>
            </div>
            <div className="flex flex-col items-center justify-center w-[300px]">
              <img src="/qr-joinurl.png" width="85%" height="auto" />
              <p className="text-lg mt-3 text-center">2. Join the game</p>
            </div>
          </div>

          {/* Teams grid - responsive layout */}
          <div className="flex-1 flex items-center justify-center p-8">
            <div
              className="grid gap-6 w-full h-full"
              style={{
                gridTemplateColumns: teamsGridStyle.gridTemplateColumns,
                gridTemplateRows: teamsGridStyle.gridTemplateRows,
                maxWidth: teamsGridStyle.maxWidth,
              }}
            >
              {teams.map((team) => {
                return (
                  <div
                    key={team.id}
                    className="flex items-center justify-center"
                  >
                    <TeamSection
                      team={team}
                      onTeamNameConfirm={(name) => {
                        handleTeamNameChange(team.id, name);
                      }}
                      players={players}
                      buzzingPlayers={buzzingPlayers}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
