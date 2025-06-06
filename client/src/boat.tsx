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

const DEBUG = true;

// ============================================================================
// TYPES
// ============================================================================

type Position = "position1" | "position2" | "position3" | "position4";

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

// Land border configuration
const BORDER_TILE_SIZE = 64; // Size of each border tile
const BORDER_THICKNESS = BORDER_TILE_SIZE; // How thick the border should be

// Game mechanics
const JOYSTICK_SENSITIVITY = 1;
const BOAT_MAX_SPEED = 0.3;
const BOAT_ACCELERATION = 0.0002;
const BOAT_DRAG = 0.98; // Friction/drag coefficient
const BOAT_ANGULAR_DRAG = 0.9;
const ROTATION_SPEED = 0.003;
const BOUNCE_DAMPING = 0.5;
const DEFAULT_GAME_DURATION = 2 * 60 * 1000; // 2 minutes in milliseconds

// Object sizes
const BOAT_WIDTH = 44;
const BOAT_HEIGHT = BOAT_WIDTH * 1.71;
const BOAT_COLLISION_RADIUS = 25;
const DUCK_SIZE = 36;
const DUCK_COLLISION_RADIUS = 15;
const ROCK_BASE_SIZES = {
  rock_1: 40,
  rock_2: 50,
  rock_3: 45,
};

// Game objects configuration
const MAX_DUCKS = 16;
const NUM_ROCKS = 15;
const MIN_SPAWN_DISTANCE = 100; // Minimum distance from boats when spawning objects

// ============================================================================
// CONSTANTS - GAME DATA
// ============================================================================

const DEFAULT_TEAMS: BoatTeam[] = [
  {
    id: "1",
    name: "Team 1",
    color: Color.Red,
    score: 0,
    type: "active",
    position: "position1",
    x: BORDER_THICKNESS + 100,
    y: (CANVAS_HEIGHT / 5) * 1,
    vx: 0,
    vy: 0,
    rotation: -Math.PI / 2,
    angularVelocity: 0,
  },
  {
    id: "2",
    name: "Team 2",
    color: Color.Blue,
    score: 0,
    type: "active",
    position: "position2",
    x: BORDER_THICKNESS + 100,
    y: (CANVAS_HEIGHT / 5) * 2,
    vx: 0,
    vy: 0,
    rotation: -Math.PI / 2,
    angularVelocity: 0,
  },
  {
    id: "3",
    name: "Team 3",
    color: Color.Green,
    score: 0,
    type: "active",
    position: "position3",
    x: BORDER_THICKNESS + 100,
    y: (CANVAS_HEIGHT / 5) * 3,
    vx: 0,
    vy: 0,
    rotation: -Math.PI / 2,
    angularVelocity: 0,
  },
  {
    id: "4",
    name: "Team 4",
    color: Color.Yellow,
    score: 0,
    type: "active",
    position: "position4",
    x: BORDER_THICKNESS + 100,
    y: (CANVAS_HEIGHT / 5) * 4,
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
 * Generate random position for ducks across the entire map
 */
const generateDuckPosition = (
  existingObjects: Array<{ x: number; y: number }>,
  rocks: Rock[],
  margin: number = 50
): { x: number; y: number } => {
  let x: number = 0;
  let y: number = 0;
  let attempts = 0;
  const maxAttempts = 100;
  let positionFound = false;

  while (!positionFound && attempts < maxAttempts) {
    x =
      BORDER_THICKNESS +
      margin +
      Math.random() * (CANVAS_WIDTH - 2 * BORDER_THICKNESS - 2 * margin);
    y =
      BORDER_THICKNESS +
      margin +
      Math.random() * (CANVAS_HEIGHT - 2 * BORDER_THICKNESS - 2 * margin);
    attempts++;

    // Check collision with teams (boats)
    const tooCloseToTeam = existingObjects.some((obj) => {
      const dx = obj.x - x;
      const dy = obj.y - y;
      return (
        Math.sqrt(dx * dx + dy * dy) <
        BOAT_COLLISION_RADIUS + DUCK_COLLISION_RADIUS + 20
      ); // 20px buffer
    });

    // Check collision with rocks using proper radii
    const tooCloseToRock = rocks.some((rock) => {
      const dx = rock.x - x;
      const dy = rock.y - y;
      return (
        Math.sqrt(dx * dx + dy * dy) < rock.radius + DUCK_COLLISION_RADIUS + 10
      ); // 10px buffer
    });

    if (!tooCloseToTeam && !tooCloseToRock) {
      positionFound = true;
    }
  }

  return { x, y };
};

/**
 * Generate initial ducks
 */
const generateDucks = (teams: BoatTeam[], rocks: Rock[]): Duck[] => {
  const ducks: Duck[] = [];
  const existingPositions: Array<{ x: number; y: number }> = [
    ...teams,
    ...rocks,
  ];

  // Generate all ducks randomly and evenly spread across the map
  for (let i = 0; i < MAX_DUCKS; i++) {
    const pos = generateDuckPosition(existingPositions, rocks);
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
 * Generate random position for rocks (avoiding only teams)
 */
const generateRockPosition = (
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
    x =
      BORDER_THICKNESS +
      margin +
      Math.random() * (CANVAS_WIDTH - 2 * BORDER_THICKNESS - 2 * margin);
    y =
      BORDER_THICKNESS +
      margin +
      Math.random() * (CANVAS_HEIGHT - 2 * BORDER_THICKNESS - 2 * margin);
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

  return { x, y };
};

/**
 * Generate initial rocks - evenly distributed across the entire map
 */
const generateRocks = (teams: BoatTeam[]): Rock[] => {
  const rocks: Rock[] = [];
  const existingPositions: Array<{ x: number; y: number }> = [...teams];
  const rockVariants: Array<"rock_1" | "rock_2" | "rock_3"> = [
    "rock_1",
    "rock_2",
    "rock_3",
  ];

  // Generate rocks evenly spread across the entire playable area
  for (let i = 0; i < NUM_ROCKS; i++) {
    const variant = rockVariants[i % rockVariants.length];
    const pos = generateRockPosition(existingPositions, MIN_SPAWN_DISTANCE);
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
  const { subscribe } = useWebSocketContext();
  const playSound = useWebAudio();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [loading, setLoading] = useState(true);
  const [numActiveTeams, setNumActiveTeams] = useState(0);
  const [, setRenderTrigger] = useState({});
  const [gameDuration, setGameDuration] = useState(DEFAULT_GAME_DURATION);
  const hasStartedGameRef = useRef(false); // Track if we've started a game before
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
      "/boat/water32.png",
      "/boat/water48.png",
      "/boat/water64.png",
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
      // Land border tiles
      "/boat/landborder_top_1.png",
      "/boat/landborder_top_2.png",
      "/boat/landborder_bottom_1.png",
      "/boat/landborder_bottom_2.png",
      "/boat/landborder_left_1.png",
      "/boat/landborder_left_2.png",
      "/boat/landborder_right_1.png",
      "/boat/landborder_right_2.png",
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
        avatar: Avatar.Icecream,
        teamId: team.id,
        dx: 0,
        dy: 0,
      }));
      stateRef.current.rocks = generateRocks(stateRef.current.teams);
      stateRef.current.ducks = generateDucks(
        stateRef.current.teams,
        stateRef.current.rocks
      );
      setNumActiveTeams(DEFAULT_TEAMS.length);
      return;
    }

    const state = stateRef.current;

    // Load teams first
    apiFetch(APIRoute.ListTeams)
      .then(({ teams }) => {
        state.teams = [];

        // Create all default teams, but only mark the first numActiveTeams as active
        for (let i = 0; i < DEFAULT_TEAMS.length; i++) {
          const defaultTeam = DEFAULT_TEAMS[i];
          if (i < teams.length) {
            // Active team with real data
            const team = teams[i];
            state.teams.push({
              ...defaultTeam,
              id: team.id,
              name: team.name,
              color: team.color,
              type: "active",
            });
          } else {
            // Dummy team (inactive)
            state.teams.push({
              ...defaultTeam,
              type: "dummy",
            });
          }
        }
        setNumActiveTeams(teams.length);

        // Generate game objects based only on active teams
        const activeTeams = state.teams.filter((t) => t.type === "active");
        state.rocks = generateRocks(activeTeams);
        state.ducks = generateDucks(activeTeams, state.rocks);

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
    const unsubscribe = subscribe(
      Channel.JOYSTICK,
      (message: WebSocketMessage) => {
        if (message.messageType !== MessageType.MOVE) {
          return;
        }

        const { playerId, angle, force } = message.payload;
        const player = stateRef.current.players.find((p) => p.id === playerId);
        if (!player) {
          console.error(`Player ${playerId} not found`);
          return;
        }

        // Convert polar coordinates to velocity components
        player.dx = JOYSTICK_SENSITIVITY * force * Math.cos(angle);
        player.dy = JOYSTICK_SENSITIVITY * force * Math.sin(angle);
      }
    );

    return unsubscribe;
  }, [subscribe]);

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

      // Average all player inputs for this team
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

      // Calculate average input (avoid division by zero)
      const avgDx = teamPlayers.length > 0 ? totalDx / teamPlayers.length : 0;
      const avgDy = teamPlayers.length > 0 ? totalDy / teamPlayers.length : 0;

      // Apply acceleration based on averaged input
      team.vx += avgDx * BOAT_ACCELERATION * deltaTime;
      team.vy += avgDy * BOAT_ACCELERATION * deltaTime;

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

      // Keep boats within bounds (accounting for land borders)
      const margin = BOAT_COLLISION_RADIUS;
      team.x = Math.max(
        BORDER_THICKNESS + margin,
        Math.min(CANVAS_WIDTH - BORDER_THICKNESS - margin, team.x)
      );
      team.y = Math.max(
        BORDER_THICKNESS + margin,
        Math.min(CANVAS_HEIGHT - BORDER_THICKNESS - margin, team.y)
      );

      // Update rotation to face movement direction
      if (speed > 0.01) {
        const targetRotation = Math.atan2(team.vy, team.vx) - Math.PI / 2; // Subtract PI/2 to make boat face upward
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

  // =================== CANVAS SIZING ===================
  const canvasScaleRef = useRef({
    scaleX: 1,
    scaleY: 1,
    displayWidth: CANVAS_WIDTH,
    displayHeight: CANVAS_HEIGHT,
  });

  const updateCanvasSize = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    // Get the actual displayed size of the canvas (set by CSS)
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width;
    const displayHeight = rect.height;

    const dpr = window.devicePixelRatio || 1;

    // Set the internal canvas resolution to match display size for crisp rendering
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    // Store scale values for coordinate system transformation
    canvasScaleRef.current = {
      scaleX: displayWidth / CANVAS_WIDTH,
      scaleY: displayHeight / CANVAS_HEIGHT,
      displayWidth,
      displayHeight,
    };
  }, []);

  useEffect(() => {
    updateCanvasSize();

    const handleResize = () => {
      updateCanvasSize();
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("fullscreenchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("fullscreenchange", handleResize);
    };
  }, [updateCanvasSize]);

  // =================== MAIN GAME LOOP ===================
  useEffect(() => {
    if (canvasRef.current === null || loading) {
      return;
    }

    // Ensure canvas is properly sized when the game loop starts
    updateCanvasSize();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    let animationFrameId: number;

    const update = (deltaTime: number) => {
      if (stateRef.current.phase !== "in_progress") {
        return;
      }

      // Update game time
      stateRef.current.currentTime =
        Date.now() - stateRef.current.gameStartTime;

      // Check if time is up
      if (stateRef.current.currentTime >= gameDuration) {
        stateRef.current.phase = "game_over";
        // Find team with highest score as winner
        const activeTeams = stateRef.current.teams.filter(
          (t) => t.type === "active"
        );
        const maxScore = Math.max(...activeTeams.map((t) => t.score));
        const winners = activeTeams.filter((t) => t.score === maxScore);
        // If there's a tie, pick the first one (could be enhanced to handle ties differently)
        stateRef.current.winner = winners[0] || null;
        return;
      }

      moveBoats(deltaTime);
      handleBoatDuckCollision();
      handleBoatRockCollision();
      handleBoatBoatCollision();
    };

    const render = () => {
      const { teams, ducks, rocks } = stateRef.current;
      const { scaleX, scaleY } = canvasScaleRef.current;
      const dpr = window.devicePixelRatio || 1;

      // Apply proper scaling for this frame
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.scale(scaleX, scaleY);

      // Clear with the virtual canvas dimensions
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      drawBackground(ctx);
      drawLandBorders(ctx);
      drawRocks(ctx, rocks);
      drawDucks(ctx, ducks);
      drawBoats(ctx, teams);

      ctx.restore();
    };

    // Render helper functions
    const drawBackground = (ctx: CanvasRenderingContext2D) => {
      const waterImg = imagesRef.current.get("/boat/water48.png");
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

    const drawLandBorders = (ctx: CanvasRenderingContext2D) => {
      // Draw top border
      const topImg1 = imagesRef.current.get("/boat/landborder_top_1.png");
      const topImg2 = imagesRef.current.get("/boat/landborder_top_2.png");
      if (topImg1 && topImg2) {
        for (let x = 0; x < CANVAS_WIDTH; x += BORDER_TILE_SIZE) {
          const tileIndex = Math.floor(x / BORDER_TILE_SIZE);
          const img = tileIndex % 2 === 0 ? topImg1 : topImg2;
          ctx.drawImage(img, x, 0, BORDER_TILE_SIZE, BORDER_TILE_SIZE);
        }
      }

      // Draw bottom border
      const bottomImg1 = imagesRef.current.get("/boat/landborder_bottom_1.png");
      const bottomImg2 = imagesRef.current.get("/boat/landborder_bottom_2.png");
      if (bottomImg1 && bottomImg2) {
        for (let x = 0; x < CANVAS_WIDTH; x += BORDER_TILE_SIZE) {
          const tileIndex = Math.floor(x / BORDER_TILE_SIZE);
          const img = tileIndex % 2 === 0 ? bottomImg1 : bottomImg2;
          ctx.drawImage(
            img,
            x,
            CANVAS_HEIGHT - BORDER_TILE_SIZE,
            BORDER_TILE_SIZE,
            BORDER_TILE_SIZE
          );
        }
      }

      // Draw left border
      const leftImg1 = imagesRef.current.get("/boat/landborder_left_1.png");
      const leftImg2 = imagesRef.current.get("/boat/landborder_left_2.png");
      if (leftImg1 && leftImg2) {
        for (let y = 0; y < CANVAS_HEIGHT; y += BORDER_TILE_SIZE) {
          const tileIndex = Math.floor(y / BORDER_TILE_SIZE);
          const img = tileIndex % 2 === 0 ? leftImg1 : leftImg2;
          ctx.drawImage(img, 0, y, BORDER_TILE_SIZE, BORDER_TILE_SIZE);
        }
      }

      // Draw right border
      const rightImg1 = imagesRef.current.get("/boat/landborder_right_1.png");
      const rightImg2 = imagesRef.current.get("/boat/landborder_right_2.png");
      if (rightImg1 && rightImg2) {
        for (let y = 0; y < CANVAS_HEIGHT; y += BORDER_TILE_SIZE) {
          const tileIndex = Math.floor(y / BORDER_TILE_SIZE);
          const img = tileIndex % 2 === 0 ? rightImg1 : rightImg2;
          ctx.drawImage(
            img,
            CANVAS_WIDTH - BORDER_TILE_SIZE,
            y,
            BORDER_TILE_SIZE,
            BORDER_TILE_SIZE
          );
        }
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
    updateCanvasSize,
  ]);

  // =================== GAME CONTROL ===================
  const start = useCallback(() => {
    const state = stateRef.current;

    // Check if this is the first game or a subsequent game
    const isFirstGame = !hasStartedGameRef.current;
    hasStartedGameRef.current = true;

    let newDucks: Duck[];
    let newRocks: Rock[];

    if (isFirstGame) {
      // First game: preserve existing map but reset duck collection status
      newDucks = state.ducks.map((duck) => ({ ...duck, collected: false }));
      newRocks = state.rocks;
    } else {
      // Subsequent games: generate completely new map
      newRocks = generateRocks(state.teams);
      newDucks = generateDucks(state.teams, newRocks);
    }

    // Reset game state, preserving active/dummy team types
    const resetTeams: BoatTeam[] = state.teams.map((t, index) => {
      const defaultTeam = DEFAULT_TEAMS.find(
        (dt) => dt.position === t.position
      )!;
      return {
        ...defaultTeam,
        id: t.id,
        name: t.name,
        color: t.color,
        type: index < numActiveTeams ? "active" : "dummy",
        score: 0,
      };
    });

    stateRef.current = {
      lastTick: 0,
      phase: "in_progress",
      teams: resetTeams,
      players: state.players,
      ducks: newDucks,
      rocks: newRocks,
      winner: null,
      gameStartTime: Date.now(),
      currentTime: 0,
    };
  }, [numActiveTeams]);

  // =================== RENDER ===================
  return (
    <div className="h-screen w-screen bg-gray-950 overflow-hidden relative">
      {/* Game Canvas - Full screen with overlays */}
      <div className="absolute inset-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="border-2 border-gray-600 rounded-lg"
          style={{
            aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}`,
            width: "min(90vw, 90vh * 1.5)", // Take 90% of viewport, respecting aspect ratio
            height: "auto",
          }}
        />
      </div>

      {/* Score Display - Top Left Overlay */}
      <div className="absolute top-4 left-4 rounded-lg p-4 min-w-[140px]">
        <div className="flex flex-col gap-2 text-white">
          <h2 className="text-lg font-bold text-center mb-1">Scores</h2>
          {stateRef.current.teams
            .filter((t) => t.type === "active")
            .slice(0, numActiveTeams)
            .map((team) => (
              <div key={team.id} className="text-center">
                <div
                  className="text-sm font-bold"
                  style={{ color: team.color }}
                >
                  {team.name}
                </div>
                <div className="text-xl font-bold">{team.score}</div>
              </div>
            ))}
        </div>
      </div>

      {/* Game Controls - Top Right Overlay */}
      <div className="absolute top-4 right-4 bg-black/80 rounded-lg p-4 flex flex-col items-center gap-3 min-w-[200px]">
        {stateRef.current.phase === "in_progress" && (
          <div className="text-center">
            <div className="text-white text-sm font-semibold">
              Time: {formatTime(gameDuration - stateRef.current.currentTime)}
            </div>
            <div className="text-gray-300 text-xs">
              {formatTime(stateRef.current.currentTime)} /{" "}
              {formatTime(gameDuration)}
            </div>
          </div>
        )}

        {stateRef.current.phase !== "in_progress" && (
          <div className="text-center w-full">
            <label className="text-white text-sm font-semibold block mb-2">
              Game Duration
            </label>
            <select
              className="bg-gray-700 text-white text-sm px-3 py-1 rounded w-full mb-3"
              value={gameDuration}
              onChange={(e) => setGameDuration(parseInt(e.target.value))}
            >
              <option value={60 * 1000}>1 minute</option>
              <option value={2 * 60 * 1000}>2 minutes</option>
              <option value={3 * 60 * 1000}>3 minutes</option>
              <option value={5 * 60 * 1000}>5 minutes</option>
              <option value={10 * 60 * 1000}>10 minutes</option>
            </select>
          </div>
        )}

        <button
          className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded disabled:opacity-50 whitespace-nowrap cursor-pointer w-full"
          disabled={loading || stateRef.current.phase === "in_progress"}
          onClick={() => start()}
        >
          {stateRef.current.phase === "not_started"
            ? "Start game"
            : "Play again"}
        </button>
      </div>

      {/* Game Over Overlay */}
      {stateRef.current.phase === "game_over" && stateRef.current.winner && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-pointer"
          onClick={() => {
            stateRef.current.phase = "not_started";
            setRenderTrigger({});
          }}
        >
          <div className="bg-gray-900 p-8 rounded-lg text-center">
            <h1
              className="text-4xl font-bold mb-4"
              style={{ color: stateRef.current.winner.color }}
            >
              {stateRef.current.winner.name} Wins!
            </h1>
            <p className="text-white text-xl mb-2">
              Final Score: {stateRef.current.winner.score} ducks
            </p>
            <div className="text-white text-lg mb-4">
              <h3 className="font-semibold mb-2">Final Standings:</h3>
              {stateRef.current.teams
                .filter((t) => t.type === "active")
                .sort((a, b) => b.score - a.score)
                .map((team, index) => (
                  <div
                    key={team.id}
                    className="flex justify-between items-center px-4 py-1"
                  >
                    <span
                      style={{ color: team.color }}
                      className="font-semibold"
                    >
                      #{index + 1} {team.name}
                    </span>
                    <span>{team.score} ducks</span>
                  </div>
                ))}
            </div>
            <p className="text-gray-300 text-sm">Click anywhere to continue</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoatGame;
