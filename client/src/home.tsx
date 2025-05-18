import { useEffect, useState } from "react";

import { APIRoute } from "../../shared/types/api/schema";
import type { WebSocketMessage } from "../../shared/types/api/websocket";
import {
  Color,
  type Player,
  type Team,
} from "../../shared/types/domain/player";
import { Channel, MessageType } from "../../shared/types/domain/websocket";
import PastelBackground from "./components/PastelBackground";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { apiFetch } from "./util/apiFetch";

type TeamSectionProps = {
  team: Team;
  onTeamNameConfirm: (name: string) => void;
  players: Player[];
};

const TeamSection = ({ team, onTeamNameConfirm }: TeamSectionProps) => {
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

  // TODO: Add player avatars to the team section
  return (
    <div className="flex flex-col justify-center w-[300px] h-full">
      <div
        className="w-full h-[240px]"
        style={{ border: `8px solid ${team.color}` }}
      ></div>
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
          className="ml-2 px-2 py-1 bg-gray-100 rounded-md hover:bg-white cursor-pointer"
          aria-label={isEditing ? "Confirm name change" : "Edit name"}
        >
          {isEditing ? "✔️" : "✏️"}
        </button>
      </div>
    </div>
  );
};

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([
    // Default teams while we wait for the server to return the actual teams
    { id: "1", name: "", color: Color.Red },
    { id: "2", name: "", color: Color.Blue },
    { id: "3", name: "", color: Color.Green },
    { id: "4", name: "", color: Color.Yellow },
  ]);
  const { subscribe, unsubscribe } = useWebSocketContext();

  useEffect(() => {
    apiFetch(APIRoute.ListTeams).then(({ teams }) => {
      setTeams(teams);
    });
  }, []);

  useEffect(() => {
    subscribe(Channel.PLAYER, (message: WebSocketMessage) => {
      if (message.messageType === MessageType.LIST) {
        setPlayers((prevPlayers) => {
          const allPlayers = [...prevPlayers, ...message.payload];
          return [...new Set(allPlayers)];
        });
      }
    });

    return () => unsubscribe(Channel.PLAYER);
  }, [subscribe, unsubscribe]);

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
            <p className="text-lg mt-3 text-center">
              1. Connect to the wifi network
            </p>
          </div>
          <div className="flex flex-col items-center justify-center w-[300px]">
            <img src="/qr-joinurl.png" width="200px" height="auto" />
            <p className="text-lg mt-3 text-center">2. Join the game</p>
          </div>
        </div>

        {/* Team sections */}
        <div
          className="flex flex-col justify-evenly items-center"
          style={{ gridArea: "center" }}
        >
          {teams[0] && (
            <TeamSection
              team={teams[0]}
              onTeamNameConfirm={(name) => {
                handleTeamNameChange(teams[0].id, name);
              }}
              players={players}
            />
          )}
          {teams[1] && (
            <TeamSection
              team={teams[1]}
              onTeamNameConfirm={(name) => {
                handleTeamNameChange(teams[1].id, name);
              }}
              players={players}
            />
          )}
        </div>
        <div
          className="flex flex-col justify-around items-center"
          style={{ gridArea: "right" }}
        >
          {teams[2] && (
            <TeamSection
              team={teams[2]}
              onTeamNameConfirm={(name) => {
                handleTeamNameChange(teams[2].id, name);
              }}
              players={players}
            />
          )}
          {teams[3] && (
            <TeamSection
              team={teams[3]}
              onTeamNameConfirm={(name) => {
                handleTeamNameChange(teams[3].id, name);
              }}
              players={players}
            />
          )}
        </div>
      </div>
    </div>
  );
}
