import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { APIRoute } from "../../shared/types/api/schema";
import type { WebSocketMessage } from "../../shared/types/api/websocket";
import type { Player, Team } from "../../shared/types/domain/player";
import { Channel, MessageType } from "../../shared/types/domain/websocket";
import { avatarToPath } from "../../shared/utils";
import PastelBackground from "./components/PastelBackground";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { useAdminAuth } from "./hooks/useAdminAuth";
import useClientRect from "./hooks/useClientRect";
import { useListenHostNavigate } from "./hooks/useListenHostNavigate";
import useWebAudio from "./hooks/useWebAudio";
import { apiFetch } from "./util/apiFetch";

type ExpandedPlayer = Player & {
  team: Team;
};

type Buzz = {
  playerId: string;
  teamId: string;
  timestamp: number;
};

const getPlayersWithDistinctTeams = (
  players: ExpandedPlayer[]
): ExpandedPlayer[] => {
  const seenTeamNames: Set<string> = new Set();
  const playersToReturn: ExpandedPlayer[] = [];
  for (const player of players) {
    if (!seenTeamNames.has(player.teamId)) {
      playersToReturn.push(player);
      seenTeamNames.add(player.teamId);
    }
  }
  return playersToReturn;
};

const BuzzerHost: React.FC = () => {
  useListenHostNavigate();
  const { isAuthenticated, passwordPrompt } = useAdminAuth({ claimHost: true });
  const { subscribe } = useWebSocketContext();
  const playSound = useWebAudio();
  const [expandedPlayers, setExpandedPlayers] = useState<
    Record<string, ExpandedPlayer>
  >({}); // id -> player
  const [teams, setTeams] = useState<Team[]>([]);
  const [buzzes, setBuzzes] = useState<Buzz[]>([]);
  const teamRowRef = useRef<HTMLElement>(null);
  const rect = useClientRect(teamRowRef);

  // Update UI and play sound when a team presses the buzzer
  const handlePlayerBuzzerPress = useCallback(
    (playerId: string, timestamp: number) => {
      const team = expandedPlayers[playerId].team;

      setBuzzes((prev) => {
        // If the player's team has already buzzed, don't add a new buzz
        if (prev.some((b) => b.teamId === team.id)) {
          return prev;
        }

        playSound("bell");

        const newBuzzes = [
          ...prev,
          { playerId, teamId: team.id, timestamp },
        ].sort((a, b) => {
          // Sort by timestamp, oldest first
          return a.timestamp - b.timestamp;
        });

        return newBuzzes;
      });
    },
    [expandedPlayers, playSound]
  );

  const handlePlayerList = useCallback((ps: Player[], ts: Team[]) => {
    const expPlayers: Record<string, ExpandedPlayer> = {};
    for (const player of ps) {
      const team = ts.find((t) => t.id === player.teamId);
      if (!team) {
        throw new Error(`Team with id ${player.teamId} not found`);
      }
      expPlayers[player.id] = { ...player, team };
    }
    setExpandedPlayers(expPlayers);
  }, []);

  // Get players and teams from backend
  useEffect(() => {
    Promise.all([apiFetch(APIRoute.ListPlayers), apiFetch(APIRoute.ListTeams)])
      .then(([{ players: ps }, { teams: ts }]) => {
        setTeams(ts);
        return { ts, ps };
      })
      .then(({ ts, ps }) => {
        handlePlayerList(ps, ts);
      })
      .catch((error) => {
        console.error("Failed to fetch players and/or teams:", error);
      });
  }, [handlePlayerList]);

  // Listen to player updates
  useEffect(() => {
    const unsubscribe = subscribe(
      Channel.PLAYER,
      (message: WebSocketMessage) => {
        if (message.messageType === MessageType.LIST) {
          handlePlayerList(message.payload, teams);
        }
      }
    );
    return unsubscribe;
  }, [handlePlayerList, subscribe, teams]);

  // Listen to buzzer presses & reset commands
  useEffect(() => {
    const unsubscribe = subscribe(
      Channel.BUZZER,
      (message: WebSocketMessage) => {
        if (message.messageType === MessageType.BUZZ) {
          handlePlayerBuzzerPress(
            message.payload.playerId,
            message.payload.timestamp
          );
        } else if (message.messageType === MessageType.RESET) {
          setBuzzes([]);
        }
      }
    );

    return unsubscribe;
  }, [handlePlayerBuzzerPress, subscribe]);

  useEffect(() => {}, [teams]);

  // Reset played teams on right click
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      event.preventDefault(); // Prevents the default context menu
      setBuzzes([]);
    };

    document.addEventListener("contextmenu", handleMouseDown);

    return () => {
      document.removeEventListener("contextmenu", handleMouseDown);
    };
  }, []);

  // For testing and going back to home screen
  useEffect(() => {
    const keydownHandler = (event: KeyboardEvent) => {
      switch (event.code) {
        case "KeyR":
          setBuzzes([]);
          break;
        case "KeyS": {
          const distinctPlayers = getPlayersWithDistinctTeams(
            Object.values(expandedPlayers)
          );
          setBuzzes(
            distinctPlayers.map((p, idx) => ({
              playerId: p.id,
              teamId: p.teamId,
              timestamp: performance.now() + idx,
            }))
          );
          break;
        }
      }
    };

    addEventListener("keydown", keydownHandler);
    return () => {
      removeEventListener("keydown", keydownHandler);
    };
  }, [expandedPlayers, teams]);

  const rowSize = useMemo(() => 100.0 / teams.length, [teams]);
  const cardSize = useMemo(() => 0.9 * rowSize, [rowSize]);
  const spacerSize = useMemo(() => 0.1 * rowSize, [rowSize]);

  return (
    <>
      {passwordPrompt}
      {!isAuthenticated && (
        <div className="absolute top-0 left-0 w-full h-full bg-black/50 flex items-center justify-center">
          <div className="text-white text-2xl">
            <p>Access denied</p>
          </div>
        </div>
      )}
      {isAuthenticated && (
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            fontFamily: "Arvo",
            height: "100vh",
            width: "100vw",
            display: "grid",
            gridTemplateColumns: "1fr 5fr 1fr",
            gridTemplateRows: `${spacerSize}fr ${teams
              .map(() => `${cardSize}fr ${spacerSize}fr`)
              .join(" ")}`,
          }}
        >
          <PastelBackground animate />
          {buzzes.map((buzz, index) => {
            const player = expandedPlayers[buzz.playerId];
            if (!player) return null;

            const team = teams.find((t) => t.id === buzz.teamId);
            if (!team) return null;

            const i = index + 1;
            const id = `row-${i}`;

            return (
              <div
                id={id}
                key={id}
                className="team-row shadow-sm"
                style={{
                  gridArea: `${2 * i} / 2 / ${2 * i + 1} / 3`,
                  backgroundColor: `${team.color}`,
                  color: "black",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: rect === null ? 0 : 0.25 * rect.height,
                  paddingLeft: "20px",
                  paddingRight: "20px",
                  position: "relative",
                }}
              >
                {/* Left spacer for balance */}
                <div style={{ flex: "1" }}></div>

                {/* Centered team name */}
                <span
                  style={{
                    textShadow: "0 0 12px rgba(255,255,255,.3)",
                    flex: "0 0 auto",
                  }}
                >
                  {team.name}
                </span>

                {/* Right-aligned avatar section */}
                <div
                  style={{
                    flex: "1",
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      gap: "5px",
                      marginRight: "6%",
                    }}
                  >
                    <img
                      src={avatarToPath(player.avatar)}
                      alt={`${player.name}'s avatar`}
                      style={{
                        height: rect === null ? 0 : 0.3 * rect.height,
                        width: rect === null ? 0 : 0.3 * rect.height,
                        filter: "drop-shadow(0 0 12px rgba(255,255,255,.3))",
                      }}
                    />
                    <span
                      style={{
                        fontSize: rect === null ? 0 : 0.085 * rect.height,
                        fontFamily: "Arvo",
                        fontWeight: "bold",
                        textShadow: "0 0 8px rgba(255,255,255,.3)",
                      }}
                    >
                      {player.name}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          <div
            id="div-only-for-ref"
            ref={teamRowRef as RefObject<HTMLDivElement>}
            style={{ gridArea: `2/3/3/4`, height: "100%" }}
          ></div>
        </div>
      )}
    </>
  );
};

export default BuzzerHost;
