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

type BoatPlayer = {
  id: string;
  name: string;
  avatar: Avatar;
  teamId: string;
  dx: number;
  dy: number;
};

type BoatTeam = {
  id: string;
  name: string;
  color: string;
  score: number;
  type: "active" | "dummy";
  position: Position;
  // Boat physics
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  angularVelocity: number;
};

type Duck = {
  id: string;
  x: number;
  y: number;
  collected: boolean;
};

type Rock = {
  id: string;
  x: number;
  y: number;
  radius: number;
  variant: "rock_1" | "rock_2" | "rock_3";
  hasMoss: boolean;
};

type State = {
  lastTick: number;
  winner: null | BoatTeam;
  phase: "not_started" | "in_progress" | "game_over";
  teams: BoatTeam[];
  players: BoatPlayer[];
  ducks: Duck[];
  rocks: Rock[];
  gameStartTime: number;
  currentTime: number;
};

// ============================================================================
// CONSTANTS - GAME CONFIGURATION
// ============================================================================

// Canvas dimensions
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

// Game mechanics
const JOYSTICK_SENSITIVITY = 0.0008;
const BOAT_MAX_SPEED = 0.3;
const BOAT_ACCELERATION = 0.0002;
const BOAT_DRAG = 0.98; // Friction/drag coefficient
const BOAT_ANGULAR_DRAG = 0.9;
const ROTATION_SPEED = 0.003;
const BOUNCE_DAMPING = 0.5;
const WINNING_SCORE = 5;

// Object sizes
const BOAT_WIDTH = 60;
const BOAT_HEIGHT = 40;
const BOAT_COLLISION_RADIUS = 25;
const DUCK_SIZE = 30;
const DUCK_COLLISION_RADIUS = 15;
const ROCK_BASE_SIZES = {
  rock_1: 40,
  rock_2: 50,
  rock_3: 45,
};

// Game objects configuration
const MAX_DUCKS = 24;
const NUM_ROCKS = 15;
const MIN_SPAWN_DISTANCE = 100; // Minimum distance from boats when spawning objects

// UI configuration
const UI_PADDING = 20;
const SCORE_HEIGHT = 60;
const TIMER_HEIGHT = 40;

// ============================================================================
// CONSTANTS - GAME DATA
// ============================================================================

const POSITIONS: Array<Position> = ["left", "right", "top", "bottom"] as const;

const DEFAULT_TEAMS: BoatTeam[] = [
  {
    id: "1",
    name: "Team 1",
    color: Color.Red,
    score: 0,
    type: "active",
    position: "left",
    x: 200,
    y: CANVAS_HEIGHT / 2,
    vx: 0,
    vy: 0,
    rotation: 0,
    angularVelocity: 0,
  },
  {
    id: "2",
    name: "Team 2",
    color: Color.Blue,
    score: 0,
    type: "active",
    position: "right",
    x: CANVAS_WIDTH - 200,
    y: CANVAS_HEIGHT / 2,
    vx: 0,
    vy: 0,
    rotation: Math.PI,
    angularVelocity: 0,
  },
  {
    id: "3",
    name: "Team 3",
    color: Color.Green,
    score: 0,
    type: "active",
    position: "top",
    x: CANVAS_WIDTH / 2,
    y: 150,
    vx: 0,
    vy: 0,
    rotation: Math.PI / 2,
    angularVelocity: 0,
  },
  {
    id: "4",
    name: "Team 4",
    color: Color.Yellow,
    score: 0,
    type: "active",
    position: "bottom",
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 150,
    vx: 0,
    vy: 0,
    rotation: -Math.PI / 2,
    angularVelocity: 0,
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the boat image path for a team color
 */
const getBoatImage = (color: string): string => {
  const colorMap: Record<string, string> = {
    [Color.Red]: "ship_red",
    [Color.Blue]: "ship_blue",
    [Color.Green]: "ship_green",
    [Color.Yellow]: "ship_yellow",
  };
  return `/boat/${colorMap[color] || "ship_blue"}.png`;
};

/**
 * Check collision between two circles
 */
const checkCircleCollision = (
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
): boolean => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < r1 + r2;
};

/**
 * Generate random position avoiding existing objects
 */
const generateRandomPosition = (
  existingObjects: Array<{ x: number; y: number }>,
  minDistance: number,
  margin: number = 50
): { x: number; y: number } => {
  let x: number = 0;
  let y: number = 0;
  let attempts = 0;
  const maxAttempts = 100;
  let positionFound = false;

  while (!positionFound && attempts < maxAttempts) {
    x = margin + Math.random() * (CANVAS_WIDTH - 2 * margin);
    y = margin + Math.random() * (CANVAS_HEIGHT - 2 * margin);
    attempts++;

    const tooClose = existingObjects.some((obj) => {
      const dx = obj.x - x;
      const dy = obj.y - y;
      return Math.sqrt(dx * dx + dy * dy) < minDistance;
    });

    if (!tooClose) {
      positionFound = true;
    }
  }

  // If maxAttempts is reached and no suitable position is found,
  // the last generated position will be returned.
  // This maintains similar behavior to the original loop.
  return { x, y };
};

/**
 * Generate initial ducks
 */
const generateDucks = (teams: BoatTeam[]): Duck[] => {
  const ducks: Duck[] = [];
  const existingPositions: Array<{ x: number; y: number }> = [...teams];

  for (let i = 0; i < MAX_DUCKS; i++) {
    const pos = generateRandomPosition(existingPositions, MIN_SPAWN_DISTANCE);
    ducks.push({
      id: `duck_${i}`,
      x: pos.x,
      y: pos.y,
      collected: false,
    });
    existingPositions.push(pos);
  }

  return ducks;
};

/**
 * Generate initial rocks
 */
const generateRocks = (teams: BoatTeam[], ducks: Duck[]): Rock[] => {
  const rocks: Rock[] = [];
  const existingPositions: Array<{ x: number; y: number }> = [
    ...teams,
    ...ducks,
  ];
  const rockVariants: Array<"rock_1" | "rock_2" | "rock_3"> = [
    "rock_1",
    "rock_2",
    "rock_3",
  ];

  for (let i = 0; i < NUM_ROCKS; i++) {
    const variant = rockVariants[i % rockVariants.length];
    const pos = generateRandomPosition(existingPositions, MIN_SPAWN_DISTANCE);
    const rock: Rock = {
      id: `rock_${i}`,
      x: pos.x,
      y: pos.y,
      radius: ROCK_BASE_SIZES[variant] / 2,
      variant,
      hasMoss: Math.random() > 0.5,
    };
    rocks.push(rock);
    existingPositions.push(pos);
  }

  return rocks;
};

/**
 * Format time in MM:SS
 */
const formatTime = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Boat Game - A multiplayer game where teams collect ducks while avoiding rocks
 */
const BoatGame = () => {
  useListenNavigate("host");
  useAdminAuth({ claimHost: true });
  const { subscribe, unsubscribe } = useWebSocketContext();
  const playSound = useWebAudio();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [loading, setLoading] = useState(true);
  const [numActiveTeams, setNumActiveTeams] = useState(0);
  const [, setRenderTrigger] = useState({});
  const stateRef = useRef<State>({
    lastTick: 0,
    winner: null,
    phase: "not_started",
    teams: [],
    players: [],
    ducks: [],
    rocks: [],
    gameStartTime: 0,
    currentTime: 0,
  });

  // Load images
  const loadImages = useCallback(() => {
    const imagePaths = [
      "/boat/water.png",
      "/boat/duck.png",
      "/boat/rock_1.png",
      "/boat/rock_1_moss.png",
      "/boat/rock_2.png",
      "/boat/rock_2_moss.png",
      "/boat/rock_3.png",
      "/boat/rock_3_moss.png",
      "/boat/ship_red.png",
      "/boat/ship_blue.png",
      "/boat/ship_green.png",
      "/boat/ship_yellow.png",
    ];

    let loadedCount = 0;
    const totalImages = imagePaths.length;

    imagePaths.forEach((path) => {
      const img = new Image();
      img.src = path;
      img.onload = () => {
        imagesRef.current.set(path, img);
        loadedCount++;
        if (loadedCount === totalImages) {
          setLoading(false);
        }
      };
      img.onerror = () => {
        console.error(`Failed to load image: ${path}`);
        loadedCount++;
        if (loadedCount === totalImages) {
          setLoading(false);
        }
      };
    });
  }, []);

  // =================== INITIALIZATION ===================
  // Load teams & players from backend
  useEffect(() => {
    loadImages();

    if (DEBUG) {
      // Use default test data in debug mode
      stateRef.current.teams = structuredClone(DEFAULT_TEAMS);
      // Ensure players exist for debug teams if keyboard control relies on them
      stateRef.current.players = DEFAULT_TEAMS.map((team) => ({
        id: `player_${team.id}_debug`,
        name: `Debug Player ${team.id}`,
        avatar: Avatar.Icecream, // TODO: Use a valid avatar
        teamId: team.id,
        dx: 0,
        dy: 0,
      }));
      stateRef.current.ducks = generateDucks(stateRef.current.teams);
      stateRef.current.rocks = generateRocks(
        stateRef.current.teams,
        stateRef.current.ducks
      );
      setNumActiveTeams(DEFAULT_TEAMS.length);
      return;
    }

    const state = stateRef.current;

    // Load teams first
    apiFetch(APIRoute.ListTeams)
      .then(({ teams }) => {
        state.teams = [];

        // Assign teams to positions
        for (let i = 0; i < teams.length && i < DEFAULT_TEAMS.length; i++) {
          const team = teams[i];
          const defaultTeam = DEFAULT_TEAMS[i];
          state.teams.push({
            ...defaultTeam,
            id: team.id,
            name: team.name,
            color: team.color,
            type: "active",
          });
        }
        setNumActiveTeams(teams.length);

        // Generate game objects
        state.ducks = generateDucks(state.teams);
        state.rocks = generateRocks(state.teams, state.ducks);

        console.log("Loaded teams", state.teams);
      })
      .then(() => {
        // Load players after teams
        return apiFetch(APIRoute.ListPlayers);
      })
      .then(({ players }) => {
        // Initialize player data
        state.players = players.map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          teamId: p.teamId,
          dx: 0,
          dy: 0,
        }));
        console.log("Loaded players", state.players);
      })
      .catch((err) => {
        console.error("Failed to load teams/players:", err);
      });
  }, [loadImages]);

  // =================== INPUT HANDLING ===================
  // Subscribe to joystick move updates from WebSocket
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

      // Apply cubic response curve for more precise control
      const cubicForce = force * force * force;

      // Convert polar coordinates to velocity components
      player.dx = cubicForce * Math.cos(angle);
      player.dy = cubicForce * Math.sin(angle);
    });

    return () => unsubscribe(Channel.JOYSTICK);
  }, [subscribe, unsubscribe]);

  // Keyboard controls for the first team (WASD)
  useEffect(() => {
    const KEYBOARD_INPUT_FORCE = 1; // Similar to max joystick force before cubic curve

    const handleKeyDown = (event: KeyboardEvent) => {
      const firstTeam = stateRef.current.teams.find((t) => t.type === "active");
      if (!firstTeam || stateRef.current.phase !== "in_progress") return;

      const firstTeamPlayer = stateRef.current.players.find(
        (p) => p.teamId === firstTeam.id
      );

      if (firstTeamPlayer) {
        // Check if this player is already controlled by a joystick
        const isJoystickControlled =
          Math.abs(firstTeamPlayer.dx) > 0 || Math.abs(firstTeamPlayer.dy) > 0;
        // Simple check: if joystick is active, maybe ignore keyboard? Or let keyboard override?
        // For now, let keyboard override/combine.

        switch (event.key.toLowerCase()) {
          case "w":
            firstTeamPlayer.dy = -KEYBOARD_INPUT_FORCE;
            break;
          case "s":
            firstTeamPlayer.dy = KEYBOARD_INPUT_FORCE;
            break;
          case "a":
            firstTeamPlayer.dx = -KEYBOARD_INPUT_FORCE;
            break;
          case "d":
            firstTeamPlayer.dx = KEYBOARD_INPUT_FORCE;
            break;
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const firstTeam = stateRef.current.teams.find((t) => t.type === "active");
      if (!firstTeam) return;

      const firstTeamPlayer = stateRef.current.players.find(
        (p) => p.teamId === firstTeam.id
      );
      if (firstTeamPlayer) {
        switch (event.key.toLowerCase()) {
          case "w":
          case "s":
            // Only reset if current dy is due to this key
            if (
              (event.key.toLowerCase() === "w" && firstTeamPlayer.dy < 0) ||
              (event.key.toLowerCase() === "s" && firstTeamPlayer.dy > 0)
            ) {
              firstTeamPlayer.dy = 0;
            }
            break;
          case "a":
          case "d":
            // Only reset if current dx is due to this key
            if (
              (event.key.toLowerCase() === "a" && firstTeamPlayer.dx < 0) ||
              (event.key.toLowerCase() === "d" && firstTeamPlayer.dx > 0)
            ) {
              firstTeamPlayer.dx = 0;
            }
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      // Reset player movement on unmount or game phase change
      const firstTeam = stateRef.current.teams.find((t) => t.type === "active");
      if (firstTeam) {
        const firstTeamPlayer = stateRef.current.players.find(
          (p) => p.teamId === firstTeam.id
        );
        if (firstTeamPlayer) {
          firstTeamPlayer.dx = 0;
          firstTeamPlayer.dy = 0;
        }
      }
    };
  }, []); // Rerun if game phase changes to ensure controls are active only during "in_progress"

  // =================== COLLISION & MOVEMENT FUNCTIONS ===================
  const handleBoatDuckCollision = useCallback(() => {
    const { teams, ducks } = stateRef.current;

    for (const team of teams) {
      if (team.type === "dummy") continue;

      for (const duck of ducks) {
        if (duck.collected) continue;

        if (
          checkCircleCollision(
            team.x,
            team.y,
            BOAT_COLLISION_RADIUS,
            duck.x,
            duck.y,
            DUCK_COLLISION_RADIUS
          )
        ) {
          duck.collected = true;
          team.score++;
          playSound("score");

          // Check for winner
          if (team.score >= WINNING_SCORE) {
            stateRef.current.phase = "game_over";
            stateRef.current.winner = team;
          }

          return;
        }
      }
    }
  }, [playSound]);

  const handleBoatRockCollision = useCallback(() => {
    const { teams, rocks } = stateRef.current;

    for (const team of teams) {
      if (team.type === "dummy") continue;

      for (const rock of rocks) {
        if (
          checkCircleCollision(
            team.x,
            team.y,
            BOAT_COLLISION_RADIUS,
            rock.x,
            rock.y,
            rock.radius
          )
        ) {
          // Calculate collision normal
          const dx = team.x - rock.x;
          const dy = team.y - rock.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const nx = dx / distance;
          const ny = dy / distance;

          // Push boat away from rock
          const overlap = BOAT_COLLISION_RADIUS + rock.radius - distance;
          team.x += nx * overlap;
          team.y += ny * overlap;

          // Bounce velocity
          const dotProduct = team.vx * nx + team.vy * ny;
          team.vx -= 2 * dotProduct * nx * BOUNCE_DAMPING;
          team.vy -= 2 * dotProduct * ny * BOUNCE_DAMPING;

          playSound("wall");
          return;
        }
      }
    }
  }, [playSound]);

  const handleBoatBoatCollision = useCallback(() => {
    const { teams } = stateRef.current;

    for (let i = 0; i < teams.length; i++) {
      const team1 = teams[i];
      if (team1.type === "dummy") continue;

      for (let j = i + 1; j < teams.length; j++) {
        const team2 = teams[j];
        if (team2.type === "dummy") continue;

        if (
          checkCircleCollision(
            team1.x,
            team1.y,
            BOAT_COLLISION_RADIUS,
            team2.x,
            team2.y,
            BOAT_COLLISION_RADIUS
          )
        ) {
          // Calculate collision normal
          const dx = team1.x - team2.x;
          const dy = team1.y - team2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const nx = dx / distance;
          const ny = dy / distance;

          // Separate boats
          const overlap = 2 * BOAT_COLLISION_RADIUS - distance;
          const separation = overlap / 2;
          team1.x += nx * separation;
          team1.y += ny * separation;
          team2.x -= nx * separation;
          team2.y -= ny * separation;

          // Exchange velocities (elastic collision)
          const v1n = team1.vx * nx + team1.vy * ny;
          const v2n = team2.vx * nx + team2.vy * ny;
          const v1t = team1.vx * -ny + team1.vy * nx;
          const v2t = team2.vx * -ny + team2.vy * nx;

          team1.vx = v2n * nx - v1t * ny;
          team1.vy = v2n * ny + v1t * nx;
          team2.vx = v1n * nx - v2t * ny;
          team2.vy = v1n * ny + v2t * nx;

          playSound("paddle");
          return;
        }
      }
    }
  }, [playSound]);

  const moveBoats = useCallback((deltaTime: number) => {
    const { teams, players } = stateRef.current;

    for (const team of teams) {
      if (team.type === "dummy") continue;

      // Sum up all player inputs for this team
      let totalDx = 0;
      let totalDy = 0;
      const teamPlayers = players.filter((p) => p.teamId === team.id);

      for (const player of teamPlayers) {
        // If player.dx/dy are from keyboard, they are already set with KEYBOARD_INPUT_FORCE.
        // If from joystick, they are set with cubicForce * cos/sin(angle).
        // The JOYSTICK_SENSITIVITY is not used here directly because it was part of cubicForce calculation.
        // However, to make keyboard comparable to joystick, we should ensure the scale is similar.
        // The BOAT_ACCELERATION is the factor that translates this "intent" to actual velocity change.
        totalDx += player.dx;
        totalDy += player.dy;
      }

      // Apply acceleration based on summed input
      team.vx += totalDx * BOAT_ACCELERATION * deltaTime;
      team.vy += totalDy * BOAT_ACCELERATION * deltaTime;

      // Apply drag
      team.vx *= BOAT_DRAG;
      team.vy *= BOAT_DRAG;

      // Limit max speed
      const speed = Math.sqrt(team.vx * team.vx + team.vy * team.vy);
      if (speed > BOAT_MAX_SPEED) {
        team.vx = (team.vx / speed) * BOAT_MAX_SPEED;
        team.vy = (team.vy / speed) * BOAT_MAX_SPEED;
      }

      // Update position
      team.x += team.vx * deltaTime;
      team.y += team.vy * deltaTime;

      // Keep boats within bounds
      const margin = BOAT_COLLISION_RADIUS;
      team.x = Math.max(margin, Math.min(CANVAS_WIDTH - margin, team.x));
      team.y = Math.max(margin, Math.min(CANVAS_HEIGHT - margin, team.y));

      // Update rotation to face movement direction
      if (speed > 0.01) {
        const targetRotation = Math.atan2(team.vy, team.vx);
        let rotationDiff = targetRotation - team.rotation;

        // Normalize rotation difference to [-π, π]
        while (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
        while (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;

        team.angularVelocity = rotationDiff * ROTATION_SPEED * deltaTime;
        team.rotation += team.angularVelocity;

        // Apply angular drag
        team.angularVelocity *= BOAT_ANGULAR_DRAG;
      }
    }
  }, []);

  // =================== MAIN GAME LOOP ===================
  useEffect(() => {
    if (canvasRef.current === null || loading) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size
    canvas.style.width = `${CANVAS_WIDTH}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    let animationFrameId: number;

    const update = (deltaTime: number) => {
      if (stateRef.current.phase !== "in_progress") {
        return;
      }

      // Update game time
      stateRef.current.currentTime =
        Date.now() - stateRef.current.gameStartTime;

      moveBoats(deltaTime);
      handleBoatDuckCollision();
      handleBoatRockCollision();
      handleBoatBoatCollision();
    };

    const render = () => {
      const { teams, ducks, rocks } = stateRef.current;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      drawBackground(ctx);
      drawRocks(ctx, rocks);
      drawDucks(ctx, ducks);
      drawBoats(ctx, teams);
      drawUI(ctx, stateRef.current);
    };

    // Render helper functions
    const drawBackground = (ctx: CanvasRenderingContext2D) => {
      const waterImg = imagesRef.current.get("/boat/water.png");
      if (waterImg) {
        const pattern = ctx.createPattern(waterImg, "repeat");
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
      } else {
        ctx.fillStyle = "#4A90E2";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    };

    const drawRocks = (ctx: CanvasRenderingContext2D, rocks: Rock[]) => {
      for (const rock of rocks) {
        const imagePath = `/boat/${rock.variant}${
          rock.hasMoss ? "_moss" : ""
        }.png`;
        const rockImg = imagesRef.current.get(imagePath);
        if (rockImg) {
          const size = rock.radius * 2;
          ctx.drawImage(
            rockImg,
            rock.x - rock.radius,
            rock.y - rock.radius,
            size,
            size
          );
        }
      }
    };

    const drawDucks = (ctx: CanvasRenderingContext2D, ducks: Duck[]) => {
      const duckImg = imagesRef.current.get("/boat/duck.png");
      if (!duckImg) return;

      for (const duck of ducks) {
        if (!duck.collected) {
          ctx.drawImage(
            duckImg,
            duck.x - DUCK_SIZE / 2,
            duck.y - DUCK_SIZE / 2,
            DUCK_SIZE,
            DUCK_SIZE
          );
        }
      }
    };

    const drawBoats = (ctx: CanvasRenderingContext2D, teams: BoatTeam[]) => {
      for (const team of teams) {
        if (team.type === "dummy") continue;

        const boatImg = imagesRef.current.get(getBoatImage(team.color));
        if (!boatImg) continue;

        ctx.save();
        ctx.translate(team.x, team.y);
        ctx.rotate(team.rotation);
        ctx.drawImage(
          boatImg,
          -BOAT_WIDTH / 2,
          -BOAT_HEIGHT / 2,
          BOAT_WIDTH,
          BOAT_HEIGHT
        );
        ctx.restore();
      }
    };

    const drawUI = (ctx: CanvasRenderingContext2D, state: State) => {
      // Draw score panel
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, SCORE_HEIGHT);

      // Draw team scores
      const activeTeams = state.teams.filter((t) => t.type === "active");
      const teamWidth = CANVAS_WIDTH / activeTeams.length;

      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      activeTeams.forEach((team, index) => {
        const x = teamWidth * index + teamWidth / 2;
        const y = SCORE_HEIGHT / 2;

        ctx.fillStyle = team.color;
        ctx.fillText(`${team.name}: ${team.score}`, x, y);
      });

      // Draw timer
      if (state.phase === "in_progress") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(
          CANVAS_WIDTH / 2 - 60,
          SCORE_HEIGHT + 10,
          120,
          TIMER_HEIGHT
        );

        ctx.fillStyle = "white";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(
          formatTime(state.currentTime),
          CANVAS_WIDTH / 2,
          SCORE_HEIGHT + 10 + TIMER_HEIGHT / 2
        );
      }

      // Draw game over screen
      if (state.phase === "game_over" && state.winner) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.font = "48px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = state.winner.color;
        ctx.fillText(
          `${state.winner.name} Wins!`,
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2 - 50
        );

        ctx.font = "24px Arial";
        ctx.fillStyle = "white";
        ctx.fillText(
          `Score: ${state.winner.score} ducks`,
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2 + 10
        );
        ctx.fillText(
          `Time: ${formatTime(state.currentTime)}`,
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2 + 50
        );
      }
    };

    const loop = (time: DOMHighResTimeStamp) => {
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
    loading,
    playSound,
    moveBoats,
    handleBoatDuckCollision,
    handleBoatRockCollision,
    handleBoatBoatCollision,
  ]);

  // =================== GAME CONTROL ===================
  const start = useCallback(() => {
    const state = stateRef.current;

    // Reset game state
    stateRef.current = {
      lastTick: 0,
      phase: "in_progress",
      teams: state.teams.map((t) => ({
        ...DEFAULT_TEAMS.find((dt) => dt.position === t.position)!,
        id: t.id,
        name: t.name,
        color: t.color,
        type: t.type,
        score: 0,
      })),
      players: state.players,
      ducks: generateDucks(state.teams),
      rocks: generateRocks(state.teams, state.ducks),
      winner: null,
      gameStartTime: Date.now(),
      currentTime: 0,
    };
  }, []);

  // =================== RENDER ===================
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-950">
      {/* Game Canvas */}
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />

      {/* Game Controls */}
      <div className="flex flex-row items-center justify-center mt-4">
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white text-lg px-6 py-2 rounded disabled:opacity-50"
          disabled={loading || stateRef.current.phase === "in_progress"}
          onClick={() => start()}
        >
          {stateRef.current.phase === "not_started"
            ? "Start Game"
            : "Play Again"}
        </button>
      </div>
    </div>
  );
};

export default BoatGame;
