import { useEffect, useState } from "react";

import { APIRoute } from "../../shared/types/api/schema";
import type { WebSocketMessage } from "../../shared/types/api/websocket";
import { type Player, type Team } from "../../shared/types/domain/player";
import { Channel, MessageType } from "../../shared/types/domain/websocket";
import { avatarToPath } from "../../shared/utils";
import PastelBackground from "./components/PastelBackground";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { useAdminAuth } from "./hooks/useAdminAuth";
import { useListenHostNavigate } from "./hooks/useListenHostNavigate";
import { apiFetch } from "./util/apiFetch";

type TeamSectionProps = {
  team: Team;
  onTeamNameConfirm: (name: string) => void;
  onTeamDelete: (teamId: string) => void;
  players: Player[];
  buzzingPlayers: Set<string>;
  canDelete: boolean;
};

const TeamSection = ({
  team,
  onTeamNameConfirm,
  onTeamDelete,
  players,
  buzzingPlayers,
  canDelete,
}: TeamSectionProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editableName, setEditableName] = useState(team.name);

  useEffect(() => {
    if (!isEditing) {
      setEditableName(team.name);
    }
  }, [team.name, isEditing]);

  const handleConfirm = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    onTeamNameConfirm(editableName);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleDelete = () => {
    if (!canDelete) return;
    onTeamDelete(team.id);
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
                  ? "hop 0.3s ease-out"
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
        <form onSubmit={handleConfirm} className="flex-1">
          <input
            type="text"
            className="w-full py-1.5 focus:outline-none focus:ring-3 focus:ring-sky-200/65"
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
        </form>
        <button
          type="button"
          onClick={isEditing ? handleConfirm : handleEdit}
          className="ml-2 px-2 py-1 bg-gray-50 rounded-md hover:bg-white cursor-pointer"
          aria-label={isEditing ? "Confirm name change" : "Edit name"}
        >
          {isEditing ? "✔️" : "✏️"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={!canDelete}
          className={`ml-2 px-2 py-1 rounded-md ${
            canDelete
              ? "bg-gray-50 hover:bg-white cursor-pointer"
              : "bg-gray-200 cursor-not-allowed opacity-80"
          }`}
          aria-label="Delete team"
        >
          ❌
        </button>
      </div>
    </div>
  );
};

type PlusButtonProps = {
  onAddTeam: () => void;
};

const PlusButton = ({ onAddTeam }: PlusButtonProps) => {
  return (
    <button
      onClick={onAddTeam}
      className="fixed bottom-6 right-6 w-12 h-12 bg-green-700 hover:bg-green-600 rounded-full shadow-lg flex items-center justify-center z-10 cursor-pointer"
      aria-label="Add new team"
    >
      <span className="text-2xl font-bold text-white -translate-y-0.25">
        ＋
      </span>
    </button>
  );
};

// Add custom hop animation styles
const hopAnimationStyle = `
@keyframes hop {
  0%, 100% { transform: translateY(0); }
  35% { transform: translateY(-8px); }
  70% { transform: translateY(3px); }
}
`;

export default function Home() {
  useListenHostNavigate();
  const { isAuthenticated, passwordPrompt } = useAdminAuth({ claimHost: true });
  const { subscribe } = useWebSocketContext();
  const [players, setPlayers] = useState<Player[]>([]);
  const [buzzingPlayers, setBuzzingPlayers] = useState<Set<string>>(new Set());
  const [teams, setTeams] = useState<Team[]>([]);

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

  const handleTeamDelete = (teamId: string) => {
    // Don't allow deleting if there are only 2 teams left
    if (teams.length <= 2) {
      alert("Cannot delete team: At least 2 teams are required.");
      return;
    }

    apiFetch(APIRoute.DeleteTeam, { teamId })
      .then(() => {
        setTeams((prevTeams) => prevTeams.filter((team) => team.id !== teamId));
      })
      .catch((error) => {
        console.error("Failed to delete team:", error);
        // Optionally show user-friendly error message
      });
  };

  const handleTeamAdd = () => {
    // Don't allow adding if there are already 4 teams
    if (teams.length >= 4) {
      alert("Cannot add team: Maximum of 4 teams allowed.");
      return;
    }

    apiFetch(APIRoute.AddTeam, {})
      .then(({ team }) => {
        setTeams((prevTeams) => [...prevTeams, team]);
      })
      .catch((error) => {
        console.error("Failed to add team:", error);
        // Optionally show user-friendly error message
      });
  };

  // Dynamic layout calculation based on number of teams
  const getTeamsGridLayout = (teamCount: number) => {
    switch (teamCount) {
      case 1:
        return {
          gridTemplateColumns: "1fr",
          gridTemplateRows: "1fr",
          maxWidth: "800px",
        };
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
      {passwordPrompt}
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
                      onTeamDelete={(teamId) => {
                        handleTeamDelete(teamId);
                      }}
                      players={players}
                      buzzingPlayers={buzzingPlayers}
                      canDelete={teams.length > 2}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Small floating add team button */}
          {teams.length < 4 && <PlusButton onAddTeam={handleTeamAdd} />}
        </div>
      )}
    </div>
  );
}
