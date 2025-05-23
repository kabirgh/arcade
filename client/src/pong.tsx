import { useCallback, useEffect, useRef, useState } from "react";

import { APIRoute } from "../../shared/types/api/schema";
import type { WebSocketMessage } from "../../shared/types/api/websocket";
import { Avatar, Color } from "../../shared/types/domain/player";
import { Channel, MessageType } from "../../shared/types/domain/websocket";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { useListenNavigate } from "./hooks/useListenNavigate";
import usePongAudio from "./hooks/usePongAudio";
import { apiFetch } from "./util/apiFetch";

const DEBUG = true;

type Position = "left" | "right" | "top" | "bottom";

type PongPlayer = {
  // x, y are the coordinates of the top-left corner of the paddle
  x: number;
  y: number;
  dx: number;
  dy: number;
  paddleLength: number;
  id: string;
  name: string;
  avatar: Avatar;
  teamId: string;
  // Position should match team position
  position: Position;
};

type PongTeam = {
  id: string;
  name: string;
  color: string;
  lives: number;
  type: "active" | "dummy";
  position: Position;
};

type Ball = {
  x: number;
  y: number;
  dx: number;
  dy: number;
};

type Wall = {
  x: number;
  y: number;
  width: number;
  height: number;
  position: Position;
  color?: string;
};

type State = {
  lastTick: number;
  winner: null | PongTeam;
  phase: "not_started" | "in_progress" | "game_over";
  walls: Wall[];
  teams: PongTeam[];
  players: PongPlayer[];
  ball: Ball;
  gameOverText: string;
};

const SCORE_LENGTH = 14;
const SCORE_THICKNESS = 5;
const SCORE_GAP = 9;
const CANVAS_SIZE = 600;
const PADDLE_LENGTH = 80;
const PADDLE_THICKNESS = 8;
const WALL_THICKNESS = PADDLE_THICKNESS;
const WALL_LENGTH = 80;
const WALL_OFFSET = SCORE_LENGTH + 4;
const PADDLE_OFFSET = WALL_OFFSET + WALL_THICKNESS + 8;
// Let the player stop 4 pixels from the wall
const PADDLE_STOP = WALL_OFFSET + WALL_THICKNESS + 4;
const BALL_SIZE = 10;
const INITIAL_BALL_SPEED = 0.18;
const SPEED_MULTIPLIER = 1.1;
const JOYSTICK_SENSITIVITY = 0.6;
const STARTING_LIVES = 2;

// I'm not sure this works, but here just in case it helps at smaller speeds
const COLLISION_EXTENSION = 1000;

const POSITIONS: Array<Position> = ["bottom", "top", "right", "left"] as const;

const DEFAULT_TEAMS: PongTeam[] = [
  {
    id: "1",
    name: "Team 1",
    color: Color.Red,
    lives: 3,
    type: "active",
    position: "left",
  },
  {
    id: "2",
    name: "Team 2",
    color: Color.Blue,
    lives: 3,
    type: "active",
    position: "right",
  },
  {
    id: "3",
    name: "Team 3",
    color: Color.Green,
    lives: 3,
    type: "active",
    position: "top",
  },
  {
    id: "4",
    name: "Team 4",
    color: Color.Yellow,
    lives: 3,
    type: "active",
    position: "bottom",
  },
];

const POSITION_TO_DEFAULT_XY: Record<Position, { x: number; y: number }> = {
  top: { x: CANVAS_SIZE / 2 - PADDLE_LENGTH / 2, y: 0 + PADDLE_OFFSET },
  bottom: {
    x: CANVAS_SIZE / 2 - PADDLE_LENGTH / 2,
    y: CANVAS_SIZE - PADDLE_THICKNESS - PADDLE_OFFSET,
  },
  left: { x: 0 + PADDLE_OFFSET, y: CANVAS_SIZE / 2 - PADDLE_LENGTH / 2 },
  right: {
    x: CANVAS_SIZE - PADDLE_THICKNESS - PADDLE_OFFSET,
    y: CANVAS_SIZE / 2 - PADDLE_LENGTH / 2,
  },
};

const DEFAULT_PLAYERS: PongPlayer[] = [
  {
    x: POSITION_TO_DEFAULT_XY.top.x,
    y: POSITION_TO_DEFAULT_XY.top.y,
    dx: 0,
    dy: 0,
    paddleLength: PADDLE_LENGTH,
    id: "top_1",
    name: "top",
    avatar: Avatar.Icecream,
    teamId: "3",
    position: "top",
  },
  {
    x: POSITION_TO_DEFAULT_XY.bottom.x,
    y: POSITION_TO_DEFAULT_XY.bottom.y,
    dx: 0,
    dy: 0,
    paddleLength: PADDLE_LENGTH,
    id: "bottom_1",
    name: "bottom",
    avatar: Avatar.Book,
    teamId: "4",
    position: "bottom",
  },
  {
    x: POSITION_TO_DEFAULT_XY.bottom.x,
    y: POSITION_TO_DEFAULT_XY.bottom.y,
    dx: 0,
    dy: 0,
    paddleLength: PADDLE_LENGTH,
    id: "bottom_2",
    name: "bottom2",
    avatar: Avatar.Spikyball,
    teamId: "4",
    position: "bottom",
  },
  {
    x: POSITION_TO_DEFAULT_XY.left.x,
    y: POSITION_TO_DEFAULT_XY.left.y,
    dx: 0,
    dy: 0,
    paddleLength: PADDLE_LENGTH,
    id: "left_1",
    name: "left",
    avatar: Avatar.Cap,
    teamId: "1",
    position: "left",
  },
  {
    x: POSITION_TO_DEFAULT_XY.right.x,
    y: POSITION_TO_DEFAULT_XY.right.y,
    dx: 0,
    dy: 0,
    paddleLength: PADDLE_LENGTH,
    id: "right_1",
    name: "right",
    avatar: Avatar.Bulb,
    teamId: "2",
    position: "right",
  },
];

const DEFAULT_WALLS: Wall[] = [
  {
    x: WALL_OFFSET,
    y: WALL_OFFSET + WALL_THICKNESS,
    width: WALL_THICKNESS,
    height: WALL_LENGTH,
    position: "left",
  },
  {
    x: WALL_OFFSET + WALL_THICKNESS,
    y: WALL_OFFSET,
    width: WALL_LENGTH,
    height: WALL_THICKNESS,
    position: "top",
  },
  {
    x: CANVAS_SIZE - WALL_OFFSET - WALL_THICKNESS,
    y: WALL_OFFSET + WALL_THICKNESS,
    width: WALL_THICKNESS,
    height: WALL_LENGTH,
    position: "right",
  },
  {
    x: CANVAS_SIZE - WALL_OFFSET - WALL_LENGTH - WALL_THICKNESS,
    y: WALL_OFFSET,
    width: WALL_LENGTH,
    height: WALL_THICKNESS,
    position: "top",
  },
  {
    x: WALL_OFFSET,
    y: CANVAS_SIZE - WALL_OFFSET - WALL_LENGTH - WALL_THICKNESS,
    width: WALL_THICKNESS,
    height: WALL_LENGTH,
    position: "left",
  },
  {
    x: WALL_OFFSET + WALL_THICKNESS,
    y: CANVAS_SIZE - WALL_OFFSET - WALL_THICKNESS,
    width: WALL_LENGTH,
    height: WALL_THICKNESS,
    position: "bottom",
  },
  {
    x: CANVAS_SIZE - WALL_OFFSET - WALL_THICKNESS,
    y: CANVAS_SIZE - WALL_OFFSET - WALL_LENGTH - WALL_THICKNESS,
    width: WALL_THICKNESS,
    height: WALL_LENGTH,
    position: "right",
  },
  {
    x: CANVAS_SIZE - WALL_OFFSET - WALL_LENGTH - WALL_THICKNESS,
    y: CANVAS_SIZE - WALL_OFFSET - WALL_THICKNESS,
    width: WALL_LENGTH,
    height: WALL_THICKNESS,
    position: "bottom",
  },
];

// Calculate paddle lengths and positions based on the number of players on the team
const calculatePaddleLengthsAndCoordinates = (
  numPlayers: number
): { paddleLength: number; coordinates: number[] } => {
  // Custom paddle lengths for different numbers of players
  // multiplying lengths: approx inrease by 10px for total size. 80, 90, 100, 110, 120, 130
  const paddleLengths = [80, 45, 33, 28, 24, 22];
  const paddleLength =
    paddleLengths[Math.min(numPlayers - 1, paddleLengths.length - 1)];

  // space evenly: paddles are distributed so that the spacing between any two paddles (and the space to the edges) is equal
  const availableSpace =
    CANVAS_SIZE -
    paddleLength * numPlayers -
    2 * WALL_OFFSET -
    2 * WALL_THICKNESS;
  const spacePerGap = availableSpace / (numPlayers + 1);

  const coordinates = [];
  for (let i = 0; i < numPlayers; i++) {
    coordinates.push(
      (i + 1) * spacePerGap + i * paddleLength + WALL_OFFSET + WALL_THICKNESS
    );
  }

  return { paddleLength, coordinates };
};

// 1-4 teams. Each team can have multiple players. Each player has their own mini-paddle.
const Quadrapong = () => {
  useListenNavigate("host");
  const { subscribe, unsubscribe } = useWebSocketContext();
  const playSound = usePongAudio();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [startingLives, setStartingLives] = useState(STARTING_LIVES);
  const [loading, setLoading] = useState(true);
  const [numActiveTeams, setNumActiveTeams] = useState(0);
  const [initialAngle] = useState(Math.random() * Math.PI * 2);
  const [, setRenderTrigger] = useState({});
  const stateRef = useRef<State>({
    lastTick: 0,
    winner: null,
    phase: "not_started",
    walls: structuredClone(DEFAULT_WALLS),
    players: [],
    teams: [],
    ball: {
      x: CANVAS_SIZE / 2,
      y: CANVAS_SIZE / 2,
      dx: INITIAL_BALL_SPEED * Math.sin(initialAngle),
      dy: INITIAL_BALL_SPEED * Math.cos(initialAngle),
    },
    gameOverText: "",
  });

  const makeWall = useCallback((position: Position) => {
    const { teams, walls } = stateRef.current;
    let newWall: Wall | null = null;

    if (position === "left") {
      newWall = {
        x: WALL_OFFSET,
        y: WALL_OFFSET + WALL_THICKNESS,
        width: WALL_THICKNESS,
        height: CANVAS_SIZE - 2 * WALL_OFFSET - 2 * WALL_THICKNESS,
        color: teams.find((t) => t.position === "left")!.color,
        position: "left",
      };
    } else if (position === "right") {
      newWall = {
        x: CANVAS_SIZE - WALL_OFFSET - WALL_THICKNESS,
        y: WALL_OFFSET + WALL_THICKNESS,
        width: WALL_THICKNESS,
        height: CANVAS_SIZE - 2 * WALL_OFFSET - 2 * WALL_THICKNESS,
        color: teams.find((t) => t.position === "right")!.color,
        position: "right",
      };
    } else if (position === "top") {
      newWall = {
        x: WALL_OFFSET + WALL_THICKNESS,
        y: WALL_OFFSET,
        width: CANVAS_SIZE - 2 * WALL_OFFSET - 2 * WALL_THICKNESS,
        height: WALL_THICKNESS,
        color: teams.find((t) => t.position === "top")!.color,
        position: "top",
      };
    } else if (position === "bottom") {
      newWall = {
        x: WALL_OFFSET + WALL_THICKNESS,
        y: CANVAS_SIZE - WALL_OFFSET - WALL_THICKNESS,
        width: CANVAS_SIZE - 2 * WALL_OFFSET - 2 * WALL_THICKNESS,
        height: WALL_THICKNESS,
        color: teams.find((t) => t.position === "bottom")!.color,
        position: "bottom",
      };
    }

    // Remove existing walls with overlap because collisions get weird with multiple walls
    stateRef.current.walls = walls.filter(
      (wall) =>
        wall.x + wall.width <= newWall!.x ||
        wall.x >= newWall!.x + newWall!.width ||
        wall.y + wall.height <= newWall!.y ||
        wall.y >= newWall!.y + newWall!.height
    );
    stateRef.current.walls.push(newWall!);
  }, []);

  const setPaddleLengthsAndCoordinates = useCallback(
    (players: PongPlayer[]) => {
      const teamToPlayers = players.reduce((acc, player) => {
        acc[player.teamId] = [...(acc[player.teamId] || []), player];
        return acc;
      }, {} as Record<string, PongPlayer[]>);

      for (const teamId in teamToPlayers) {
        const players = teamToPlayers[teamId];
        const c = ["left", "right"].includes(players[0].position) ? "y" : "x";
        const { paddleLength, coordinates } =
          calculatePaddleLengthsAndCoordinates(players.length);

        for (let i = 0; i < players.length; i++) {
          players[i].paddleLength = paddleLength;
          players[i][c] = coordinates[i];
        }
      }
    },
    []
  );

  // Get teams & players from backend
  useEffect(() => {
    if (DEBUG) {
      stateRef.current.teams = structuredClone(DEFAULT_TEAMS);
      stateRef.current.players = structuredClone(DEFAULT_PLAYERS);

      setPaddleLengthsAndCoordinates(stateRef.current.players);

      setNumActiveTeams(DEFAULT_TEAMS.length);
      setLoading(false);
      return;
    }

    const state = stateRef.current;

    apiFetch(APIRoute.ListTeams)
      .then(({ teams }) => {
        for (let i = 0; i < teams.length; i++) {
          const team = teams[i];

          state.teams.push({
            id: team.id,
            name: team.name,
            color: team.color,
            lives: STARTING_LIVES,
            type: "active",
            position: POSITIONS[i],
          });
        }
        setNumActiveTeams(teams.length);
        console.log("Loaded teams", stateRef.current.teams);
      })
      .then(() => {
        return apiFetch(APIRoute.ListPlayers);
      })
      .then(({ players }) => {
        // Set the player position based on the team position
        const teamIdToDefaultPosition: Record<
          string,
          { position: Position; x: number; y: number }
        > = {};
        for (let i = 0; i < stateRef.current.teams.length; i++) {
          teamIdToDefaultPosition[stateRef.current.teams[i].id] = {
            position: stateRef.current.teams[i].position,
            x: POSITION_TO_DEFAULT_XY[stateRef.current.teams[i].position].x,
            y: POSITION_TO_DEFAULT_XY[stateRef.current.teams[i].position].y,
          };
        }

        stateRef.current.players = players.map((p) => {
          const defaultPosition = teamIdToDefaultPosition[p.teamId];
          return {
            ...p,
            dx: 0,
            dy: 0,
            position: defaultPosition.position,
            // x, y, paddleLength are overwritten in setPaddleLengthsAndCoordinates
            x: 0,
            y: 0,
            paddleLength: 200,
          };
        });
        setPaddleLengthsAndCoordinates(stateRef.current.players);

        setLoading(false);
        console.log("Loaded players", stateRef.current.players);
      })
      .catch((err) => {
        console.error(err);
      });
  }, [setPaddleLengthsAndCoordinates]);

  // If user changes the starting lives, update the teams
  // It should be impossible to change the starting lives while the game is running
  useEffect(() => {
    const { teams } = stateRef.current;
    for (const team of teams) {
      team.lives = startingLives;
    }
  }, [startingLives]);

  // Subscribe to joystick move updates
  useEffect(() => {
    subscribe(Channel.JOYSTICK, (message: WebSocketMessage) => {
      if (message.messageType !== MessageType.MOVE) {
        return;
      }

      const { playerId, angle, force } = message.payload;
      const player = stateRef.current.players.find((p) => p.id === playerId);
      if (!player) {
        console.error(`Player ${playerId} not found`);
        return;
      }

      // Angle of 0 = right
      player.dx = force * Math.cos(angle) * JOYSTICK_SENSITIVITY;
      player.dy = force * Math.sin(angle) * JOYSTICK_SENSITIVITY;
    });

    return () => unsubscribe(Channel.JOYSTICK);
  }, [subscribe, unsubscribe]);

  const handleTeamPaddleCollision = useCallback(
    (playersOfTeam: PongPlayer[], position: Position) => {
      const { ball } = stateRef.current;
      const [bl, br, bt, bb] = [
        ball.x,
        ball.x + BALL_SIZE,
        ball.y,
        ball.y + BALL_SIZE,
      ];

      // pl, pr, pt, pb
      const effectivePaddles: [number, number, number, number][] = [];
      // Combine overlapping paddles into a single effective paddle
      let c: "x" | "y";
      if (position === "left" || position === "right") {
        c = "y";
      } else {
        c = "x";
      }

      // First, sort by coordinates
      playersOfTeam.sort((a, b) => a[c] - b[c]);

      // Helper function to add an effective paddle to the array
      const addEffectivePaddle = (start: number, end: number) => {
        if (position === "left" || position === "right") {
          // For vertical paddles, x is fixed, y varies
          const x1 = playersOfTeam[start].x;
          const x2 = x1 + PADDLE_THICKNESS;
          const y1 = playersOfTeam[start].y;
          const y2 = playersOfTeam[end].y + playersOfTeam[end].paddleLength;
          effectivePaddles.push([x1, x2, y1, y2]);
        } else {
          // For horizontal paddles, y is fixed, x varies
          const x1 = playersOfTeam[start].x;
          const x2 = playersOfTeam[end].x + playersOfTeam[end].paddleLength;
          const y1 = playersOfTeam[start].y;
          const y2 = y1 + PADDLE_THICKNESS;
          effectivePaddles.push([x1, x2, y1, y2]);
        }
      };

      let overlapStartIndex: number = 0;
      let overlapEndIndex: number = 0;

      // i=1 because we compare to the previous player
      for (let i = 1; i < playersOfTeam.length; i++) {
        const player = playersOfTeam[i];
        const prevPlayer = playersOfTeam[i - 1];
        if (prevPlayer[c] + prevPlayer.paddleLength >= player[c]) {
          // This paddle overlaps with the previous paddle
          overlapEndIndex = i;
        } else {
          // This paddle does not overlap with the previous paddle
          // Push the complete paddle to the effective paddles
          addEffectivePaddle(overlapStartIndex, overlapEndIndex);
          // Reset the overlap indices
          overlapStartIndex = i;
          overlapEndIndex = i;
        }
      }
      // Handle the final group of paddles
      if (playersOfTeam.length > 0) {
        addEffectivePaddle(overlapStartIndex, overlapEndIndex);
      }

      // For each effective paddle, check if the ball is colliding with it
      for (let [pl, pr, pt, pb] of effectivePaddles) {
        // Avoid tunneling effect from fast balls
        if (position === "left") {
          pl -= COLLISION_EXTENSION;
        } else if (position === "right") {
          pr += COLLISION_EXTENSION;
        } else if (position === "top") {
          pt -= COLLISION_EXTENSION;
        } else if (position === "bottom") {
          pb += COLLISION_EXTENSION;
        }

        // Check if ball is colliding with paddle
        if (bl < pr && br > pl && bt < pb && bb > pt) {
          // Reset ball to 'front' of paddle
          if (position === "left") {
            ball.x = pr;
          } else if (position === "right") {
            ball.x = pl - BALL_SIZE;
          } else if (position === "top") {
            ball.y = pb;
          } else if (position === "bottom") {
            ball.y = pt - BALL_SIZE;
          }

          // Calculate the collision point
          const collisionPoint =
            position === "left" || position === "right"
              ? (ball.y + BALL_SIZE / 2 - pt) / (pb - pt)
              : (ball.x + BALL_SIZE / 2 - pl) / (pr - pl);

          // Normalize collision point to [-1, 1]
          const normalizedCollisionPoint = collisionPoint * 2 - 1;

          // Calculate new angle (up to 75 degrees)
          const maxAngle = (Math.PI * 5) / 12; // 75 degrees
          const newAngle =
            normalizedCollisionPoint *
            maxAngle *
            (position === "left" || position === "right" ? -1 : 1);

          const speed =
            SPEED_MULTIPLIER * Math.sqrt(ball.dx ** 2 + ball.dy ** 2);

          // Update ball direction based on which paddle was hit
          if (position === "left" || position === "right") {
            ball.dx =
              speed * Math.cos(newAngle) * (position === "left" ? 1 : -1);
            ball.dy = speed * -Math.sin(newAngle);
          } else {
            ball.dx = speed * Math.sin(newAngle);
            ball.dy =
              speed * Math.cos(newAngle) * (position === "top" ? 1 : -1);
          }

          playSound("paddle");

          return true;
        }
      }
      return false;
    },
    [playSound]
  );

  const handleWallCollision = useCallback(
    (ball: Ball, wall: Wall) => {
      let [wl, wr, wt, wb] = [
        wall.x,
        wall.x + wall.width,
        wall.y,
        wall.y + wall.height,
      ];

      // Avoid tunneling effect from fast balls
      if (wall.position === "left") {
        wl -= COLLISION_EXTENSION;
      } else if (wall.position === "right") {
        wr += COLLISION_EXTENSION;
      } else if (wall.position === "top") {
        wt -= COLLISION_EXTENSION;
      } else if (wall.position === "bottom") {
        wb += COLLISION_EXTENSION;
      }

      const [bl, br, bt, bb] = [
        ball.x,
        ball.x + BALL_SIZE,
        ball.y,
        ball.y + BALL_SIZE,
      ];

      // Check if ball is colliding with wall
      if (br > wl && bl < wr && bb > wt && bt < wb) {
        // Reset ball to 'front' of wall
        if (wall.position === "left") {
          ball.x = wr;
        } else if (wall.position === "right") {
          ball.x = wl - BALL_SIZE;
        } else if (wall.position === "top") {
          ball.y = wb;
        } else if (wall.position === "bottom") {
          ball.y = wt - BALL_SIZE;
        }

        if (wall.width > wall.height) {
          // Horizontal wall
          ball.dy = -ball.dy * SPEED_MULTIPLIER;
          ball.dx = ball.dx * SPEED_MULTIPLIER;
        } else {
          // Vertical wall
          ball.dx = -ball.dx * SPEED_MULTIPLIER;
          ball.dy = ball.dy * SPEED_MULTIPLIER;
        }

        playSound("wall");

        return true;
      }
      return false;
    },
    [playSound]
  );

  const movePlayers = useCallback((deltaTime: number) => {
    const { players } = stateRef.current;

    let c: "x" | "y";
    let dc: "dx" | "dy";

    for (const player of players) {
      if (player.position === "left" || player.position === "right") {
        c = "y";
        dc = "dy";
      } else {
        c = "x";
        dc = "dx";
      }

      player[c] = Math.max(
        PADDLE_STOP,
        Math.min(
          CANVAS_SIZE - player.paddleLength - PADDLE_STOP,
          player[c] + player[dc] * deltaTime * JOYSTICK_SENSITIVITY
        )
      );
    }
  }, []);

  const moveBall = useCallback((deltaTime: number) => {
    const { ball } = stateRef.current;
    // Update ball position
    ball.x += ball.dx * deltaTime;
    ball.y += ball.dy * deltaTime;
  }, []);

  useEffect(() => {
    const keydownHandler = (event: KeyboardEvent) => {
      const bottomPlayers = stateRef.current.players.filter(
        (p) => p.position === "bottom"
      );
      switch (event.code) {
        case "KeyA":
          bottomPlayers[0].x = Math.max(PADDLE_STOP, bottomPlayers[0].x - 20);
          break;
        case "KeyD":
          bottomPlayers[0].x = Math.min(
            CANVAS_SIZE - bottomPlayers[0].paddleLength - PADDLE_STOP,
            bottomPlayers[0].x + 20
          );
          break;
        case "ArrowLeft":
          bottomPlayers[1].x = Math.max(PADDLE_STOP, bottomPlayers[1].x - 20);
          break;
        case "ArrowRight":
          bottomPlayers[1].x = Math.min(
            CANVAS_SIZE - bottomPlayers[1].paddleLength - PADDLE_STOP,
            bottomPlayers[1].x + 20
          );
          break;
      }
    };

    addEventListener("keydown", keydownHandler);
    return () => {
      removeEventListener("keydown", keydownHandler);
    };
  }, []);

  useEffect(() => {
    if (canvasRef.current === null) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    // Set the canvas size in CSS pixels
    canvas.style.width = `${CANVAS_SIZE}px`;
    canvas.style.height = `${CANVAS_SIZE}px`;
    // Set the canvas size in actual pixels
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    // Scale the context to ensure correct drawing operations
    ctx.scale(dpr, dpr);

    let animationFrameId: number;

    const update = (deltaTime: number) => {
      const { ball, players, walls, teams } = stateRef.current;

      if (stateRef.current.phase !== "in_progress") {
        return;
      }

      if (!DEBUG) {
        movePlayers(deltaTime);
      }

      moveBall(deltaTime);

      // Collision with paddles
      for (const team of teams) {
        if (team.lives <= 0 || team.type === "dummy") {
          continue;
        }

        const playersOfTeam = players.filter((p) => p.teamId === team.id);
        if (handleTeamPaddleCollision(playersOfTeam, team.position)) {
          return; // Collision handled for this frame
        }
      }

      // Collision with walls
      for (const wall of walls) {
        if (handleWallCollision(ball, wall)) {
          return;
        }
      }

      const [bl, br, bt, bb] = [
        ball.x,
        ball.x + BALL_SIZE,
        ball.y,
        ball.y + BALL_SIZE,
      ];

      // Reset ball when out of bounds & reduce player lives
      if (
        bl < WALL_OFFSET ||
        br > CANVAS_SIZE - WALL_OFFSET ||
        bt < WALL_OFFSET ||
        bb > CANVAS_SIZE - WALL_OFFSET
      ) {
        // Reduce lives. Let it go negative, we use the 0 marker to add
        // additional walls to the game area
        if (bl < WALL_OFFSET) {
          stateRef.current.teams.find((t) => t.position === "left")!.lives -= 1;
          playSound("score");
          if (
            stateRef.current.teams.find((t) => t.position === "left")!.lives ===
            0
          ) {
            makeWall("left");
          }
        }
        if (br > CANVAS_SIZE - WALL_OFFSET) {
          stateRef.current.teams.find(
            (t) => t.position === "right"
          )!.lives -= 1;
          playSound("score");
          if (
            stateRef.current.teams.find((t) => t.position === "right")!
              .lives === 0
          ) {
            makeWall("right");
          }
        }
        if (bt < WALL_OFFSET) {
          stateRef.current.teams.find((t) => t.position === "top")!.lives -= 1;
          playSound("score");
          if (
            stateRef.current.teams.find((t) => t.position === "top")!.lives ===
            0
          ) {
            makeWall("top");
          }
        }
        if (bb > CANVAS_SIZE - WALL_OFFSET) {
          stateRef.current.teams.find(
            (t) => t.position === "bottom"
          )!.lives -= 1;
          playSound("score");
          if (
            stateRef.current.teams.find((t) => t.position === "bottom")!
              .lives === 0
          ) {
            makeWall("bottom");
          }
        }

        ball.x = CANVAS_SIZE / 2;
        ball.y = CANVAS_SIZE / 2;
        ball.dx = 0;
        ball.dy = 0;

        // If there is only one player left & we started with multiple players, game over
        let playersLeft = 0;
        let lastTeamStanding: PongTeam | null = null;
        for (const team of teams) {
          if (team.lives > 0 && team.type === "active") {
            playersLeft += 1;
            // Set winner now, will be unset if there is more than one player left
            lastTeamStanding = team;
          }
        }

        stateRef.current.winner = null; // Default to null
        if (playersLeft === 1 && numActiveTeams > 1) {
          stateRef.current.phase = "game_over";
          stateRef.current.winner = lastTeamStanding;
          stateRef.current.gameOverText = `${
            stateRef.current.winner!.name
          }   wins!`.toUpperCase();
        } else if (playersLeft === 0 && numActiveTeams > 0) {
          // Changed numActiveTeams == 1 to > 0
          stateRef.current.phase = "game_over";
          stateRef.current.gameOverText = "GAME   OVER";
        }

        // Pause before firing ball again
        setTimeout(() => {
          // const randomAngle = Math.random() * Math.PI * 2;
          // Not random for testing, will change to random later
          const randomAngle = 0; // straight down
          ball.x = CANVAS_SIZE / 2;
          ball.y = CANVAS_SIZE / 2;
          ball.dx = INITIAL_BALL_SPEED * Math.sin(randomAngle);
          ball.dy = INITIAL_BALL_SPEED * Math.cos(randomAngle);
        }, 500);
      }
    };

    const render = () => {
      const { ball, players, walls, teams } = stateRef.current;
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Draw walls
      for (const wall of walls) {
        ctx.fillStyle = wall.color ?? "white";
        ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
      }

      // Draw player-related elements
      for (const player of players) {
        const playerTeam = teams.find((t) => t.position === player.position);
        if (
          !playerTeam ||
          playerTeam.lives <= 0 ||
          playerTeam.type === "dummy"
        ) {
          // Don't draw player if their team is out or is a dummy (wall will be drawn by makeWall)
          continue;
        }

        // Draw player paddle
        ctx.fillStyle = playerTeam.color;
        if (player.position === "left" || player.position === "right") {
          ctx.fillRect(
            player.x,
            player.y,
            PADDLE_THICKNESS,
            player.paddleLength
          );
        } else {
          ctx.fillRect(
            player.x,
            player.y,
            player.paddleLength,
            PADDLE_THICKNESS
          );
        }

        // Draw player lives (Team lives)
        ctx.fillStyle = playerTeam.color;
        for (let i = 0; i < playerTeam.lives; i++) {
          if (player.position === "left") {
            ctx.fillRect(
              0,
              WALL_OFFSET +
                WALL_THICKNESS +
                WALL_LENGTH -
                SCORE_THICKNESS -
                1 -
                i * SCORE_GAP,
              SCORE_LENGTH,
              SCORE_THICKNESS
            );
          }
          if (player.position === "right") {
            ctx.fillRect(
              CANVAS_SIZE - SCORE_LENGTH,
              CANVAS_SIZE -
                WALL_OFFSET -
                WALL_THICKNESS -
                WALL_LENGTH +
                1 +
                i * SCORE_GAP,
              SCORE_LENGTH,
              SCORE_THICKNESS
            );
          }
          if (player.position === "top") {
            ctx.fillRect(
              CANVAS_SIZE -
                WALL_OFFSET -
                WALL_THICKNESS -
                WALL_LENGTH +
                1 +
                i * SCORE_GAP,
              0,
              SCORE_THICKNESS,
              SCORE_LENGTH
            );
          }
          if (player.position === "bottom") {
            ctx.fillRect(
              WALL_OFFSET +
                WALL_THICKNESS +
                WALL_LENGTH -
                SCORE_THICKNESS -
                1 -
                i * SCORE_GAP,
              CANVAS_SIZE - SCORE_LENGTH,
              SCORE_THICKNESS,
              SCORE_LENGTH
            );
          }
        }
      }

      // Draw (square) ball
      if (stateRef.current.phase !== "game_over") {
        ctx.fillStyle = "white";
        ctx.fillRect(ball.x, ball.y, BALL_SIZE, BALL_SIZE);
      }

      if (stateRef.current.phase === "game_over") {
        ctx.font = "36px Pong Score";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = stateRef.current.winner?.color || "white";
        ctx.fillText(
          stateRef.current.gameOverText,
          CANVAS_SIZE / 2,
          CANVAS_SIZE / 2
        );
        return;
      }
    };

    const loop = (time: DOMHighResTimeStamp) => {
      // Initialize lastTick if it's the first frame
      if (stateRef.current.lastTick === 0) {
        stateRef.current.lastTick = time;
        animationFrameId = window.requestAnimationFrame(loop);
        return;
      }

      const deltaTime = time - stateRef.current.lastTick;
      stateRef.current.lastTick = time;

      update(deltaTime);
      render();
      setRenderTrigger({});
      animationFrameId = window.requestAnimationFrame(loop);
    };

    animationFrameId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [
    playSound,
    makeWall,
    numActiveTeams,
    handleTeamPaddleCollision,
    handleWallCollision,
    moveBall,
    movePlayers,
  ]);

  const start = useCallback(() => {
    const state = stateRef.current;

    // Reset teams lives for a new game
    for (const team of state.teams) {
      team.lives = startingLives;
      team.type = "active";
    }
    // Reset players to their initial positions
    setPaddleLengthsAndCoordinates(state.players);

    stateRef.current = {
      ...state, // Keep lastTick, etc.
      phase: "in_progress",
      walls: structuredClone(DEFAULT_WALLS),
      teams: state.teams,
      players: state.players,
      ball: {
        // Reset ball
        x: CANVAS_SIZE / 2,
        y: CANVAS_SIZE / 2,
        dx: INITIAL_BALL_SPEED * Math.sin(initialAngle),
        dy: INITIAL_BALL_SPEED * Math.cos(initialAngle),
      },
      winner: null,
      gameOverText: "",
    };

    // Process dummy teams to make walls
    for (const team of stateRef.current.teams) {
      if (team.type === "dummy") {
        // The color for dummy walls is handled by makeWall itself if not specified, or by the team color.
        makeWall(team.position);
      }
    }
  }, [setPaddleLengthsAndCoordinates, initialAngle, startingLives, makeWall]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-950">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        // className="border border-solid border-white"
      />
      <div
        className="flex flex-col items-center justify-center"
        style={{
          visibility:
            stateRef.current.phase === "in_progress" ? "hidden" : "visible",
        }}
      >
        <input
          className="w-12 mx-4 py-0.5 px-2 bg-white focus:outline-none"
          type="number"
          placeholder="lives"
          value={startingLives}
          min={1}
          max={10}
          onChange={(e) => {
            setStartingLives(e.target.valueAsNumber);
          }}
        />
        <button
          className="w-16 bg-gray-200 text-black text-sm px-3 py-1 mb-0 mt-2"
          disabled={loading}
          onClick={() => start()}
        >
          {stateRef.current.phase === "not_started" ? "Start" : "Play again"}
        </button>
      </div>
    </div>
  );
};

export default Quadrapong;
