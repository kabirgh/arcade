import { useCallback, useEffect, useRef, useState } from "react";

import { APIRoute } from "../../shared/types/api/schema";
import type { WebSocketMessage } from "../../shared/types/api/websocket";
import { Avatar, Color } from "../../shared/types/domain/player";
import { Channel, MessageType } from "../../shared/types/domain/websocket";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { useAdminAuth } from "./hooks/useAdminAuth";
import { useListenNavigate } from "./hooks/useListenNavigate";
import useWebAudio from "./hooks/useWebAudio";
import { apiFetch } from "./util/apiFetch";

const DEBUG = false;

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// CONSTANTS - GAME CONFIGURATION
// ============================================================================

// Canvas dimensions
const CANVAS_SIZE = 600;

// Scoring display
const SCORE_LENGTH = 14;
const SCORE_THICKNESS = 5;
const SCORE_GAP = 9;

// Paddle dimensions
const PADDLE_LENGTH = 80;
const PADDLE_THICKNESS = 8;

// Wall dimensions and positioning
const WALL_THICKNESS = PADDLE_THICKNESS;
const WALL_LENGTH = 80;
const WALL_OFFSET = SCORE_LENGTH + 4;

// Paddle positioning
const PADDLE_OFFSET = WALL_OFFSET + WALL_THICKNESS + 8;
const PADDLE_STOP = WALL_OFFSET + WALL_THICKNESS + 4; // Let the player stop 4 pixels from the wall

// Ball properties
const BALL_SIZE = 10;
const INITIAL_BALL_SPEED = 0.18;
const SPEED_MULTIPLIER = 1.1;

// Game mechanics
const JOYSTICK_SENSITIVITY = 0.6;
const STARTING_LIVES = 2;
const COLLISION_EXTENSION = 1000; // Helps prevent tunneling at high speeds

// ============================================================================
// CONSTANTS - GAME DATA
// ============================================================================

const POSITIONS: Array<Position> = ["bottom", "top", "right", "left"] as const;

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
  // Left side walls
  {
    x: WALL_OFFSET,
    y: WALL_OFFSET + WALL_THICKNESS,
    width: WALL_THICKNESS,
    height: WALL_LENGTH,
    position: "left",
  },
  {
    x: WALL_OFFSET,
    y: CANVAS_SIZE - WALL_OFFSET - WALL_LENGTH - WALL_THICKNESS,
    width: WALL_THICKNESS,
    height: WALL_LENGTH,
    position: "left",
  },
  // Top side walls
  {
    x: WALL_OFFSET + WALL_THICKNESS,
    y: WALL_OFFSET,
    width: WALL_LENGTH,
    height: WALL_THICKNESS,
    position: "top",
  },
  {
    x: CANVAS_SIZE - WALL_OFFSET - WALL_LENGTH - WALL_THICKNESS,
    y: WALL_OFFSET,
    width: WALL_LENGTH,
    height: WALL_THICKNESS,
    position: "top",
  },
  // Right side walls
  {
    x: CANVAS_SIZE - WALL_OFFSET - WALL_THICKNESS,
    y: WALL_OFFSET + WALL_THICKNESS,
    width: WALL_THICKNESS,
    height: WALL_LENGTH,
    position: "right",
  },
  {
    x: CANVAS_SIZE - WALL_OFFSET - WALL_THICKNESS,
    y: CANVAS_SIZE - WALL_OFFSET - WALL_LENGTH - WALL_THICKNESS,
    width: WALL_THICKNESS,
    height: WALL_LENGTH,
    position: "right",
  },
  // Bottom side walls
  {
    x: WALL_OFFSET + WALL_THICKNESS,
    y: CANVAS_SIZE - WALL_OFFSET - WALL_THICKNESS,
    width: WALL_LENGTH,
    height: WALL_THICKNESS,
    position: "bottom",
  },
  {
    x: CANVAS_SIZE - WALL_OFFSET - WALL_LENGTH - WALL_THICKNESS,
    y: CANVAS_SIZE - WALL_OFFSET - WALL_THICKNESS,
    width: WALL_LENGTH,
    height: WALL_THICKNESS,
    position: "bottom",
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate paddle lengths and positions based on the number of players on a team.
 * Paddles are distributed evenly with equal spacing between them.
 */
const calculatePaddleLengthsAndCoordinates = (
  numPlayers: number
): { paddleLength: number; coordinates: number[] } => {
  // Custom paddle lengths for different numbers of players
  // multiplying lengths: approx increase by 10px for total size. 80, 90, 100, 110, 120, 130
  const paddleLengths = [80, 45, 33, 28, 24, 22];
  const paddleLength =
    paddleLengths[Math.min(numPlayers - 1, paddleLengths.length - 1)];

  // Space evenly: paddles are distributed so that the spacing between any two paddles
  // (and the space to the edges) is equal
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

/**
 * Get the coordinate key (x or y) based on position
 */
const getCoordinateKey = (position: Position): "x" | "y" => {
  return ["left", "right"].includes(position) ? "y" : "x";
};

/**
 * Get the velocity key (dx or dy) based on position
 */
const getVelocityKey = (position: Position): "dx" | "dy" => {
  return ["left", "right"].includes(position) ? "dy" : "dx";
};

/**
 * Create a full-length wall for a team that's out
 */
const createFullWall = (position: Position, color: string): Wall => {
  switch (position) {
    case "left":
      return {
        x: WALL_OFFSET,
        y: WALL_OFFSET + WALL_THICKNESS,
        width: WALL_THICKNESS,
        height: CANVAS_SIZE - 2 * WALL_OFFSET - 2 * WALL_THICKNESS,
        color,
        position: "left",
      };
    case "right":
      return {
        x: CANVAS_SIZE - WALL_OFFSET - WALL_THICKNESS,
        y: WALL_OFFSET + WALL_THICKNESS,
        width: WALL_THICKNESS,
        height: CANVAS_SIZE - 2 * WALL_OFFSET - 2 * WALL_THICKNESS,
        color,
        position: "right",
      };
    case "top":
      return {
        x: WALL_OFFSET + WALL_THICKNESS,
        y: WALL_OFFSET,
        width: CANVAS_SIZE - 2 * WALL_OFFSET - 2 * WALL_THICKNESS,
        height: WALL_THICKNESS,
        color,
        position: "top",
      };
    case "bottom":
      return {
        x: WALL_OFFSET + WALL_THICKNESS,
        y: CANVAS_SIZE - WALL_OFFSET - WALL_THICKNESS,
        width: CANVAS_SIZE - 2 * WALL_OFFSET - 2 * WALL_THICKNESS,
        height: WALL_THICKNESS,
        color,
        position: "bottom",
      };
  }
};

/**
 * Check if ball is out of bounds on a specific side
 */
const isBallOutOfBounds = (ball: Ball, position: Position): boolean => {
  const [bl, br, bt, bb] = [
    ball.x,
    ball.x + BALL_SIZE,
    ball.y,
    ball.y + BALL_SIZE,
  ];

  switch (position) {
    case "left":
      return bl < WALL_OFFSET;
    case "right":
      return br > CANVAS_SIZE - WALL_OFFSET;
    case "top":
      return bt < WALL_OFFSET;
    case "bottom":
      return bb > CANVAS_SIZE - WALL_OFFSET;
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Quadrapong - A 4-player pong game where teams defend their sides
 * 1-4 teams can play, each team can have multiple players with mini-paddles
 */
const Quadrapong = () => {
  useListenNavigate("host");
  // TODO: use value of isAuthenticated?
  useAdminAuth({ claimHost: true });
  const { subscribe, unsubscribe } = useWebSocketContext();
  const playSound = useWebAudio();
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
    ball: { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2, dx: 0, dy: 0 },
    gameOverText: "",
  });

  const makeWall = useCallback((position: Position) => {
    const { teams, walls } = stateRef.current;
    const team = teams.find((t) => t.position === position);
    const newWall = createFullWall(position, team?.color || "white");

    // Remove existing walls with overlap because collisions get weird with multiple walls
    stateRef.current.walls = walls.filter(
      (wall) =>
        wall.x + wall.width <= newWall.x ||
        wall.x >= newWall.x + newWall.width ||
        wall.y + wall.height <= newWall.y ||
        wall.y >= newWall.y + newWall.height
    );
    stateRef.current.walls.push(newWall);
  }, []);

  const setPaddleLengthsAndCoordinates = useCallback(
    (playersArr: PongPlayer[]): PongPlayer[] => {
      const updatedPlayers = structuredClone(playersArr);

      // Group players by team
      const teamToPlayers: Record<
        string,
        { originalIndex: number; player: PongPlayer }[]
      > = {};

      for (let i = 0; i < updatedPlayers.length; i++) {
        const player = updatedPlayers[i];
        const val = { originalIndex: i, player };
        if (!teamToPlayers[player.teamId]) {
          teamToPlayers[player.teamId] = [val];
        } else {
          teamToPlayers[player.teamId].push(val);
        }
      }

      // Calculate paddle lengths and positions for each team
      for (const [, playersInTeam] of Object.entries(teamToPlayers)) {
        const { paddleLength, coordinates } =
          calculatePaddleLengthsAndCoordinates(playersInTeam.length);

        const position = playersInTeam[0].player.position;
        const coordinateKey = getCoordinateKey(position);

        // Update each player's paddle length and position
        for (let i = 0; i < playersInTeam.length; i++) {
          const { originalIndex } = playersInTeam[i];
          // Update the player's paddle length and coordinates in the cloned array
          // We do this to keep the original player ordering unchanged
          updatedPlayers[originalIndex].paddleLength = paddleLength;
          updatedPlayers[originalIndex][coordinateKey] = coordinates[i];
        }
      }

      return updatedPlayers;
    },
    []
  );

  // =================== INITIALIZATION ===================
  // Get teams & players from backend
  useEffect(() => {
    if (DEBUG) {
      // Use default test data in debug mode
      stateRef.current.teams = structuredClone(DEFAULT_TEAMS);
      stateRef.current.players = setPaddleLengthsAndCoordinates(
        structuredClone(DEFAULT_PLAYERS)
      );

      setNumActiveTeams(DEFAULT_TEAMS.length);
      setLoading(false);
      return;
    }

    const state = stateRef.current;

    // Load teams first
    apiFetch(APIRoute.ListTeams)
      .then(({ teams }) => {
        state.teams = [];
        const unusedColors = ["padding1", "padding2"].concat(
          DEFAULT_TEAMS.map((t) => t.color).filter(
            (c) => !teams.some((t) => t.color === c)
          )
        );

        // Assign teams to positions, fill empty slots with dummy teams
        for (let i = 0; i < DEFAULT_TEAMS.length; i++) {
          if (i < teams.length) {
            const team = teams[i];
            state.teams.push({
              id: team.id,
              name: team.name,
              color: team.color,
              lives: STARTING_LIVES,
              type: "active",
              position: POSITIONS[i],
            });
          } else {
            // Create dummy team with wall
            state.teams.push({
              id: DEFAULT_TEAMS[i].id,
              name: DEFAULT_TEAMS[i].name,
              color: unusedColors[i],
              lives: 0,
              type: "dummy",
              position: POSITIONS[i],
            });
            makeWall(POSITIONS[i]);
          }
        }
        setNumActiveTeams(teams.length);
        console.log("Loaded teams", stateRef.current.teams);
      })
      .then(() => {
        // Load players after teams
        return apiFetch(APIRoute.ListPlayers);
      })
      .then(({ players }) => {
        // Map players to their team positions
        const teamIdToDefaultPosition: Record<
          string,
          { position: Position; x: number; y: number }
        > = {};
        for (let i = 0; i < stateRef.current.teams.length; i++) {
          const pos = stateRef.current.teams[i].position;
          teamIdToDefaultPosition[stateRef.current.teams[i].id] = {
            position: pos,
            x: POSITION_TO_DEFAULT_XY[pos].x,
            y: POSITION_TO_DEFAULT_XY[pos].y,
          };
        }

        // Initialize player data
        const ps = players.map((p) => {
          const defaultPosition = teamIdToDefaultPosition[p.teamId];
          return {
            ...p,
            dx: 0,
            dy: 0,
            position: defaultPosition.position,
            // x, y, paddleLength will be overwritten in setPaddleLengthsAndCoordinates
            x: defaultPosition.x,
            y: defaultPosition.y,
            paddleLength: PADDLE_LENGTH,
          };
        });
        stateRef.current.players = setPaddleLengthsAndCoordinates(ps);
        console.log("Loaded players", stateRef.current.players);

        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load teams/players:", err);
      });
  }, [setPaddleLengthsAndCoordinates, makeWall]);

  // =================== GAME STATE MANAGEMENT ===================
  // Update team lives when starting lives changes
  useEffect(() => {
    const { teams } = stateRef.current;
    for (const team of teams) {
      team.lives = startingLives;
    }
  }, [startingLives]);

  // =================== INPUT HANDLING ===================
  // Subscribe to joystick move updates from WebSocket
  useEffect(() => {
    subscribe(Channel.JOYSTICK, (message: WebSocketMessage) => {
      if (message.messageType !== MessageType.MOVE) {
        return;
      }

      console.log("joystick move", message);

      const { playerId, angle, force } = message.payload;
      const player = stateRef.current.players.find((p) => p.id === playerId);
      if (!player) {
        console.error(`Player ${playerId} not found`);
        return;
      }

      // Convert polar coordinates to velocity
      // Angle of 0 = right
      player.dx = force * Math.cos(angle) * JOYSTICK_SENSITIVITY;
      // player.dy = force * Math.sin(angle) * JOYSTICK_SENSITIVITY;
      console.log("playerId", playerId, "angle", angle, "force", force);
      console.log("player dx", player.dx, "dy", player.dy);
    });

    return () => unsubscribe(Channel.JOYSTICK);
  }, [subscribe, unsubscribe]);

  // Debug keyboard controls
  useEffect(() => {
    // if (!DEBUG) return;

    const keydownHandler = (event: KeyboardEvent) => {
      const bottomPlayers = stateRef.current.players.filter(
        (p) => p.position === "bottom"
      );

      const moveDistance = 20;
      switch (event.code) {
        case "KeyA":
          if (bottomPlayers[0]) {
            bottomPlayers[0].x = Math.max(
              PADDLE_STOP,
              bottomPlayers[0].x - moveDistance
            );
          }
          break;
        case "KeyD":
          if (bottomPlayers[0]) {
            bottomPlayers[0].x = Math.min(
              CANVAS_SIZE - bottomPlayers[0].paddleLength - PADDLE_STOP,
              bottomPlayers[0].x + moveDistance
            );
          }
          break;
        case "ArrowLeft":
          if (bottomPlayers[1]) {
            bottomPlayers[1].x = Math.max(
              PADDLE_STOP,
              bottomPlayers[1].x - moveDistance
            );
          }
          break;
        case "ArrowRight":
          if (bottomPlayers[1]) {
            bottomPlayers[1].x = Math.min(
              CANVAS_SIZE - bottomPlayers[1].paddleLength - PADDLE_STOP,
              bottomPlayers[1].x + moveDistance
            );
          }
          break;
      }
    };

    addEventListener("keydown", keydownHandler);
    return () => {
      removeEventListener("keydown", keydownHandler);
    };
  }, []);

  // =================== COLLISION & MOVEMENT FUNCTIONS ===================
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
      const coordinateKey = getCoordinateKey(position);

      // First, sort by coordinates
      playersOfTeam.sort((a, b) => a[coordinateKey] - b[coordinateKey]);

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
        if (
          prevPlayer[coordinateKey] + prevPlayer.paddleLength >=
          player[coordinateKey]
        ) {
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

    for (const player of players) {
      const coordinateKey = getCoordinateKey(player.position);
      const velocityKey = getVelocityKey(player.position);

      // Calculate new position based on velocity
      const newPosition =
        player[coordinateKey] +
        player[velocityKey] * deltaTime * JOYSTICK_SENSITIVITY;

      // Constrain paddle within bounds
      player[coordinateKey] = Math.max(
        PADDLE_STOP,
        Math.min(CANVAS_SIZE - player.paddleLength - PADDLE_STOP, newPosition)
      );
    }
  }, []);

  const moveBall = useCallback((deltaTime: number) => {
    const { ball } = stateRef.current;
    // Update ball position
    ball.x += ball.dx * deltaTime;
    ball.y += ball.dy * deltaTime;
  }, []);

  // =================== MAIN GAME LOOP ===================
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

    // Disable antialiasing to prevent overlap artifacts
    ctx.imageSmoothingEnabled = false;
    (ctx as any).webkitImageSmoothingEnabled = false;
    (ctx as any).mozImageSmoothingEnabled = false;
    (ctx as any).msImageSmoothingEnabled = false;
    // Additional settings for pixel-perfect rendering
    ctx.translate(0.5, 0.5); // Align to pixel grid
    canvas.style.imageRendering = "pixelated";
    canvas.style.imageRendering = "crisp-edges";

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
        // Handle scoring for each position
        for (const position of POSITIONS) {
          if (isBallOutOfBounds(ball, position)) {
            const team = stateRef.current.teams.find(
              (t) => t.position === position
            );
            if (team) {
              team.lives -= 1;
              playSound("score");

              // Create wall when team is eliminated
              if (team.lives === 0) {
                makeWall(position);
              }
            }
          }
        }

        // Reset ball to center
        ball.x = CANVAS_SIZE / 2;
        ball.y = CANVAS_SIZE / 2;
        ball.dx = 0;
        ball.dy = 0;

        // Check game over conditions
        const activeTeams = teams.filter(
          (t) => t.lives > 0 && t.type === "active"
        );
        const activeTeamCount = activeTeams.length;

        stateRef.current.winner = null;
        if (activeTeamCount === 1 && numActiveTeams > 1) {
          // One team left - they win
          stateRef.current.phase = "game_over";
          stateRef.current.winner = activeTeams[0];
          stateRef.current.gameOverText =
            `${activeTeams[0].name}   wins!`.toUpperCase();
        } else if (activeTeamCount === 0 && numActiveTeams > 0) {
          // No teams left - game over
          stateRef.current.phase = "game_over";
          stateRef.current.gameOverText = "GAME   OVER";
        }

        // Pause before firing ball again
        setTimeout(() => {
          // TODO: Make this random again after testing
          const randomAngle = Math.PI / 2; // straight right for testing
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

      drawWalls(ctx, walls);
      drawPlayers(ctx, players, teams);
      drawBall(ctx, ball);
      drawGameOverScreen(ctx, stateRef.current);
    };

    // Render helper functions
    const drawWalls = (ctx: CanvasRenderingContext2D, walls: Wall[]) => {
      for (const wall of walls) {
        ctx.fillStyle = wall.color ?? "white";
        ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
      }
    };

    const drawPlayers = (
      ctx: CanvasRenderingContext2D,
      players: PongPlayer[],
      teams: PongTeam[]
    ) => {
      for (const player of players) {
        const playerTeam = teams.find((t) => t.position === player.position);
        if (
          !playerTeam ||
          playerTeam.lives <= 0 ||
          playerTeam.type === "dummy"
        ) {
          // Don't draw player if their team is out or is a dummy
          continue;
        }

        // TODO: draw player avatar
        drawPaddle(ctx, player, playerTeam);
        drawTeamLives(ctx, playerTeam);
      }
    };

    const drawPaddle = (
      ctx: CanvasRenderingContext2D,
      player: PongPlayer,
      team: PongTeam
    ) => {
      ctx.fillStyle = team.color;
      if (player.position === "left" || player.position === "right") {
        ctx.fillRect(player.x, player.y, PADDLE_THICKNESS, player.paddleLength);
      } else {
        ctx.fillRect(player.x, player.y, player.paddleLength, PADDLE_THICKNESS);
      }
    };

    const drawTeamLives = (ctx: CanvasRenderingContext2D, team: PongTeam) => {
      ctx.fillStyle = team.color;

      for (let i = 0; i < team.lives; i++) {
        const scorePositions = {
          left: {
            x: 0,
            y:
              WALL_OFFSET +
              WALL_THICKNESS +
              WALL_LENGTH -
              SCORE_THICKNESS -
              1 -
              i * SCORE_GAP,
            width: SCORE_LENGTH,
            height: SCORE_THICKNESS,
          },
          right: {
            x: CANVAS_SIZE - SCORE_LENGTH,
            y:
              CANVAS_SIZE -
              WALL_OFFSET -
              WALL_THICKNESS -
              WALL_LENGTH +
              1 +
              i * SCORE_GAP,
            width: SCORE_LENGTH,
            height: SCORE_THICKNESS,
          },
          top: {
            x:
              CANVAS_SIZE -
              WALL_OFFSET -
              WALL_THICKNESS -
              WALL_LENGTH +
              1 +
              i * SCORE_GAP,
            y: 0,
            width: SCORE_THICKNESS,
            height: SCORE_LENGTH,
          },
          bottom: {
            x:
              WALL_OFFSET +
              WALL_THICKNESS +
              WALL_LENGTH -
              SCORE_THICKNESS -
              1 -
              i * SCORE_GAP,
            y: CANVAS_SIZE - SCORE_LENGTH,
            width: SCORE_THICKNESS,
            height: SCORE_LENGTH,
          },
        };

        const pos = scorePositions[team.position];
        ctx.fillRect(pos.x, pos.y, pos.width, pos.height);
      }
    };

    const drawBall = (ctx: CanvasRenderingContext2D, ball: Ball) => {
      if (stateRef.current.phase !== "game_over") {
        ctx.fillStyle = "white";
        ctx.fillRect(ball.x, ball.y, BALL_SIZE, BALL_SIZE);
      }
    };

    const drawGameOverScreen = (
      ctx: CanvasRenderingContext2D,
      state: State
    ) => {
      if (state.phase === "game_over") {
        ctx.font = "36px Pong Score";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = state.winner?.color || "white";
        ctx.fillText(state.gameOverText, CANVAS_SIZE / 2, CANVAS_SIZE / 2);
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

  // =================== GAME CONTROL ===================
  const start = useCallback(() => {
    const state = stateRef.current;

    // Reset game state
    stateRef.current = {
      lastTick: 0,
      phase: "in_progress",
      walls: structuredClone(DEFAULT_WALLS),
      teams: state.teams.map((t) => ({
        ...t,
        lives: startingLives,
      })),
      // Reset players to their initial positions
      players: setPaddleLengthsAndCoordinates(state.players),
      ball: {
        x: CANVAS_SIZE / 2,
        y: CANVAS_SIZE / 2,
        dx: INITIAL_BALL_SPEED * Math.sin(initialAngle),
        dy: INITIAL_BALL_SPEED * Math.cos(initialAngle),
      },
      winner: null,
      gameOverText: "",
    };

    // Create walls for dummy teams
    for (const team of stateRef.current.teams) {
      if (team.type === "dummy") {
        makeWall(team.position);
      }
    }
  }, [setPaddleLengthsAndCoordinates, initialAngle, startingLives, makeWall]);

  // =================== RENDER ===================
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-950">
      {/* Game Canvas */}
      <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} />

      {/* Game Controls */}
      <div
        className="flex flex-row items-center justify-center"
        style={{
          visibility:
            stateRef.current.phase === "in_progress" ? "hidden" : "visible",
        }}
      >
        {/* Lives Input */}
        <input
          className="w-12 mx-4 py-0.5 px-2 bg-white focus:outline-none"
          type="number"
          placeholder="lives"
          value={startingLives}
          min={1}
          max={9}
          onChange={(e) => {
            setStartingLives(e.target.valueAsNumber);
          }}
        />

        {/* Start/Play Again Button */}
        <button
          className="bg-gray-200 text-black text-sm px-3 py-1"
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
