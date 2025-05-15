import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import useClientRect from "./hooks/useClientRect";
import { useVolumeControl } from "./hooks/useVolumeControl";
import { APIRoute } from "../../shared/types/routes";
import type { Player, Team } from "../../shared/types/player";
import { Channel, MessageType } from "../../shared/types/websocket";
import type { WebSocketMessage } from "../../shared/types/websocket";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { useLocation } from "wouter";

const BuzzerHost: React.FC = () => {
  const [, setLocation] = useLocation();
  const { subscribe } = useWebSocketContext();
  const [teams, setTeams] = useState([] as Team[]);
  const [played, setPlayed] = useState([] as Team[]);
  const { volume } = useVolumeControl(0.5);
  const teamRowRef = useRef<HTMLElement>(null);
  // TODO: unlock audio https://chatgpt.com/c/68246cd3-479c-8002-8f17-434e2b9f5844
  const audioRef = useRef<HTMLAudioElement>(null);
  const rect = useClientRect(teamRowRef);

  // Update UI and play sound when a team presses the buzzer
  const handlePlayerBuzzerPress = useCallback(
    (player: Player) => {
      // TODO: match on team name
      const team = teams.find((team) => team.color === player.color);
      if (!team) {
        return;
      }
      setPlayed((prev) => {
        if (prev.includes(team)) {
          return prev;
        }
        const newPlayed = [...prev, team];

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

  // Get teams from backend
  useEffect(() => {
    fetch(APIRoute.Teams)
      .then((res) => res.json())
      .then((data) => setTeams(data));
  }, []);

  // Listen to buzzer presses
  useEffect(() => {
    subscribe(Channel.BUZZER, (message: WebSocketMessage) => {
      if (message.messageType === MessageType.BUZZ) {
        handlePlayerBuzzerPress(message.payload.player);
      }
    });
  }, [handlePlayerBuzzerPress]);

  // Reset played teams on right click
  useEffect(() => {
    const handleMouseDown = (event: any) => {
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
    const keydownHandler = (event: any) => {
      switch (event.code) {
        case "KeyR":
          setPlayed([]);
          break;
        case "KeyS":
          setPlayed(teams);
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
  }, [teams, setLocation]);

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
          .map((_team) => `${cardSize}fr ${spacerSize}fr`)
          .join(" ")}`,
      }}
    >
      {played.map((team, index) => {
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
              justifyContent: "center",
              alignItems: "center",
              fontSize: rect === null ? 0 : 0.25 * rect.height,
            }}
          >
            {team.name}
          </div>
        );
      })}

      <div
        id="div-only-for-ref"
        ref={teamRowRef as any}
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
