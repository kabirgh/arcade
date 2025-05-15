import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import useClientRect from "./hooks/useClientRect";
import { useVolumeControl } from "./hooks/useVolumeControl";
import { APIRoute } from "../../shared/types/api/schema";
import type { Player, Team } from "../../shared/types/domain/player";
import { Channel, MessageType } from "../../shared/types/domain/websocket";
import type { WebSocketMessage } from "../../shared/types/api/websocket";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { useLocation } from "wouter";

const getPlayersWithDistinctTeams = (players: Player[]): Player[] => {
  const seenTeamNames: Set<string> = new Set();
  const playersToReturn: Player[] = [];
  for (const player of players) {
    if (!seenTeamNames.has(player.team.name)) {
      playersToReturn.push(player);
      seenTeamNames.add(player.team.name);
    }
  }
  return playersToReturn;
};

const BuzzerHost: React.FC = () => {
  const [, setLocation] = useLocation();
  const { subscribe } = useWebSocketContext();
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [played, setPlayed] = useState<Player[]>([]);
  const { volume } = useVolumeControl(0.5);
  const teamRowRef = useRef<HTMLElement>(null);
  // TODO: unlock audio https://chatgpt.com/c/68246cd3-479c-8002-8f17-434e2b9f5844
  const audioRef = useRef<HTMLAudioElement>(null);
  const rect = useClientRect(teamRowRef);

  // Update UI and play sound when a team presses the buzzer
  const handlePlayerBuzzerPress = useCallback(
    (player: Player) => {
      const team = teams.find((team) => team.name === player.team.name);
      if (!team) {
        return;
      }
      setPlayed((prev) => {
        if (prev.includes(player)) {
          return prev;
        }
        const newPlayed = [...prev, player];

        if (!audioRef.current) {
          return prev;
        }
        audioRef.current.pause(); // Pause the currently playing sound
        audioRef.current.currentTime = 0; // Reset playback to the start
        audioRef.current.play(); // Play the sound again

        return newPlayed;
      });

      // TODO: show player avatar next to team name
    },
    [teams]
  );

  // Get players and teams from backend
  useEffect(() => {
    fetch(APIRoute.Players)
      .then((res) => res.json())
      .then((players) => {
        setPlayers(players);
      });
    fetch(APIRoute.Teams)
      .then((res) => res.json())
      .then((teams) => {
        setTeams(teams);
      });
  }, []);

  // Listen to buzzer presses
  useEffect(() => {
    subscribe(Channel.BUZZER, (message: WebSocketMessage) => {
      if (message.messageType === MessageType.BUZZ) {
        handlePlayerBuzzerPress(message.payload.player);
      }
    });
  }, [handlePlayerBuzzerPress, subscribe]);

  // Reset played teams on right click
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      event.preventDefault(); // Prevents the default context menu
      setPlayed([]);
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
          setPlayed([]);
          break;
        case "KeyS":
          setPlayed(getPlayersWithDistinctTeams(players));
          break;
        case "Backspace":
          setPlayed([]);
          setLocation("/");
          break;
      }
    };

    addEventListener("keydown", keydownHandler);
    return () => {
      removeEventListener("keydown", keydownHandler);
    };
  }, [players, setLocation]);

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
      {played.map((player, index) => {
        const i = index + 1;
        const id = `row-${i}`;

        return (
          <div
            id={id}
            key={id}
            className="team-row"
            style={{
              gridArea: `${2 * i} / 2 / ${2 * i + 1} / 3`,
              backgroundColor: `${player.team.color}`,
              color: "black",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: rect === null ? 0 : 0.25 * rect.height,
              paddingLeft: "20px",
              paddingRight: "20px",
            }}
          >
            <span>{player.team.name}</span>
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
                src={`/avatars/${player.avatar}.png`}
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
