import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "wouter";

import { APIRoute } from "../../shared/types/api/schema";
import type { WebSocketMessage } from "../../shared/types/api/websocket";
import type { Player, Team } from "../../shared/types/domain/player";
import { Channel, MessageType } from "../../shared/types/domain/websocket";
import { avatarToPath } from "../../shared/utils";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import useClientRect from "./hooks/useClientRect";
import { useVolumeControl } from "./hooks/useVolumeControl";
import { fetchApi } from "./util/fetchApi";

type ExpandedPlayer = Player & {
  team: Team;
};

type Buzz = {
  playerId: string;
  teamId: string;
  timestamp: number;
};

const getPlayersWithDistinctTeams = (players: Player[]): Player[] => {
  const seenTeamNames: Set<string> = new Set();
  const playersToReturn: Player[] = [];
  for (const player of players) {
    if (!seenTeamNames.has(player.teamId)) {
      playersToReturn.push(player);
      seenTeamNames.add(player.teamId);
    }
  }
  return playersToReturn;
};

const BuzzerHost: React.FC = () => {
  const [, setLocation] = useLocation();
  const { subscribe, unsubscribe } = useWebSocketContext();
  const [players, setPlayers] = useState<Player[]>([]);
  const [expandedPlayers, setExpandedPlayers] = useState<
    Record<string, ExpandedPlayer>
  >({}); // id -> player
  const [teams, setTeams] = useState<Team[]>([]);
  const [buzzes, setBuzzes] = useState<Buzz[]>([]);
  const { volume } = useVolumeControl(0.5);
  const teamRowRef = useRef<HTMLElement>(null);
  // TODO: unlock audio https://chatgpt.com/c/68246cd3-479c-8002-8f17-434e2b9f5844
  const audioRef = useRef<HTMLAudioElement>(null);
  const rect = useClientRect(teamRowRef);

  // Update UI and play sound when a team presses the buzzer
  const handlePlayerBuzzerPress = useCallback(
    (player: Player, timestamp: number) => {
      console.log("handlePlayerBuzzerPress", player, timestamp);

      const team = teams.find((team) => team.id === player.teamId);
      if (!team) {
        console.error(`Team with id ${player.teamId} not found`);
        return;
      }

      setBuzzes((prev) => {
        // If the player's team has already buzzed, don't add a new buzz
        if (prev.some((b) => b.teamId === team.id)) {
          return prev;
        }
        const newBuzzes = [
          ...prev,
          { playerId: player.id, teamId: team.id, timestamp },
        ].sort((a, b) => {
          // Sort by timestamp, oldest first
          return a.timestamp - b.timestamp;
        });

        if (!audioRef.current) {
          return prev;
        }
        audioRef.current.pause(); // Pause the currently playing sound
        audioRef.current.currentTime = 0; // Reset playback to the start
        audioRef.current.play(); // Play the sound again

        return newBuzzes;
      });
    },
    [teams]
  );

  // Get players and teams from backend
  useEffect(() => {
    fetchApi(APIRoute.ListPlayers)
      .then(({ players }) => {
        setPlayers(players);
      })
      .catch((error) => {
        console.error("Failed to fetch players:", error);
      });
    fetchApi(APIRoute.ListTeams)
      .then(({ teams }) => {
        setTeams(teams);
      })
      .catch((error) => {
        console.error("Failed to fetch teams:", error);
      });
  }, []);

  // Subscribe to player list updates
  useEffect(() => {
    subscribe(Channel.PLAYER, (message: WebSocketMessage) => {
      console.log("Received message on player channel:", message);
      if (message.messageType === MessageType.LIST) {
        setPlayers(message.payload as Player[]);
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe(Channel.PLAYER);
      }
    };
  }, [subscribe, unsubscribe]);

  // Listen to buzzer presses & reset commands
  useEffect(() => {
    subscribe(Channel.BUZZER, (message: WebSocketMessage) => {
      if (message.messageType === MessageType.BUZZ) {
        handlePlayerBuzzerPress(
          message.payload.player,
          message.payload.timestamp
        );
      } else if (message.messageType === MessageType.RESET) {
        setBuzzes([]);
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe(Channel.BUZZER);
      }
    };
  }, [handlePlayerBuzzerPress, subscribe, unsubscribe]);

  useEffect(() => {
    const expPlayers: Record<string, ExpandedPlayer> = {};
    for (const player of players) {
      const team = teams.find((t) => t.id === player.teamId);
      if (!team) {
        throw new Error(`Team with id ${player.teamId} not found`);
      }
      expPlayers[player.id] = { ...player, team };
    }
    setExpandedPlayers(expPlayers);
  }, [teams, players]);

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
          const distinctPlayers = getPlayersWithDistinctTeams(players);
          setBuzzes(
            distinctPlayers.map((p, idx) => ({
              playerId: p.id,
              teamId: p.teamId,
              timestamp: performance.now() + idx,
            }))
          );
          break;
        }
        case "Backspace":
          setBuzzes([]);
          setLocation("/");
          break;
      }
    };

    addEventListener("keydown", keydownHandler);
    return () => {
      removeEventListener("keydown", keydownHandler);
    };
  }, [players, setLocation, teams]);

  // Update volume of hidden audio element
  useEffect(() => {
    if (!audioRef.current) {
      return;
    }
    audioRef.current.volume = volume;
  }, [volume]);

  const rowSize = useMemo(() => 100.0 / teams.length, [teams]);
  const cardSize = useMemo(() => 0.9 * rowSize, [rowSize]);
  const spacerSize = useMemo(() => 0.1 * rowSize, [rowSize]);

  return (
    <div
      style={{
        fontFamily: "Arvo",
        backgroundColor: "#323232",
        height: "100vh",
        width: "100vw",
        display: "grid",
        gridTemplateColumns: "1fr 8fr 1fr",
        gridTemplateRows: `${spacerSize}fr ${teams
          .map(() => `${cardSize}fr ${spacerSize}fr`)
          .join(" ")}`,
      }}
    >
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
            className="team-row"
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
            }}
          >
            <span>{team.name}</span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "5px",
              }}
            >
              <img
                src={avatarToPath(player.avatar)}
                alt={`${player.name}'s avatar`}
                style={{
                  height: rect === null ? 0 : 0.3 * rect.height,
                  width: rect === null ? 0 : 0.3 * rect.height,
                  borderRadius: "50%",
                }}
              />
              <span
                style={{
                  fontSize: rect === null ? 0 : 0.12 * rect.height,
                  fontFamily: "sans-serif",
                  fontWeight: "bold",
                }}
              >
                {player.name}
              </span>
            </div>
          </div>
        );
      })}

      <div
        id="div-only-for-ref"
        ref={teamRowRef as RefObject<HTMLDivElement>}
        style={{ gridArea: `2/3/3/4`, height: "100%" }}
      ></div>
      <audio
        ref={audioRef}
        src="/audio/bell.mp3"
        style={{ display: "none" }}
        preload="auto"
      ></audio>
    </div>
  );
};

export default BuzzerHost;
