import { useCallback, useEffect, useRef, useState } from "react";

import { APIRoute } from "../../shared/types/api/schema";
import type { WebSocketMessage } from "../../shared/types/api/websocket";
import { Avatar, Color, type Player } from "../../shared/types/domain/player";
import { Channel, MessageType } from "../../shared/types/domain/websocket";
import { shuffle } from "../../shared/utils";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { useAdminAuth } from "./hooks/useAdminAuth";
import { useListenNavigate } from "./hooks/useListenNavigate";
import useWebAudio from "./hooks/useWebAudio";
import { apiFetch } from "./util/apiFetch";

// Use dummy players. When false, calls server to get real players
const DEBUG = true;

//
// Types
//
type NinjaPlayer = {
  id: string;
  name: string;
  avatar: string;
  color: string; // same as team color
  teamId: string;
  x: number;
  y: number;
  vx: number;
  score: number;
  obstacles: Obstacle[];
  isGameOver: boolean;
  currentAnimation: "run" | "roll" | "hit" | "fall";
  currentFrame: number;
  lastFrameUpdate: number;
  wall: "left" | "right" | "none";
  msPerFrame: number;
};

type Obstacle = {
  x: number;
  y: number;
  currentFrame: number;
  lastFrameUpdate: number;
};

type NinjaTeam = {
  id: string;
  name: string;
  color: string;
  players: NinjaPlayer[];
  currentPlayerIndex: number;
  state: "not_started" | "playing" | "countdown" | "game_over";
  countdownStartTime?: number;
  countdownMessage?: string;
};

type GameState = {
  teams: NinjaTeam[];
  obstaclePoolsByPlayerIndex: ObstaclePool[];
  speed: number;
  obstacleBag: number[];
  lastTick: number;
  // not_started is only at before the first game starts
  phase: "not_started" | "in_progress" | "game_over";
  gameStartTime: number;
  speedUpdateAccumulator: number;
  playerIdToTeamIdMap: Record<string, string>;
};

class ObstaclePool {
  private pool: Obstacle[] = [];
  private activeObstacles: Obstacle[] = [];

  constructor(initialSize: number) {
    this.activeObstacles = structuredClone(DEFAULT_OBSTACLES);
    for (let i = 0; i < initialSize - this.activeObstacles.length; i++) {
      this.pool.push({ x: 0, y: 0, currentFrame: 0, lastFrameUpdate: 0 });
    }
  }

  getObstacle(x: number, y: number): Obstacle {
    let obstacle: Obstacle;
    if (this.pool.length > 0) {
      obstacle = this.pool.pop()!;
    } else {
      obstacle = { x: 0, y: 0, currentFrame: 0, lastFrameUpdate: 0 };
    }
    obstacle.x = x;
    obstacle.y = y;
    this.activeObstacles.push(obstacle);
    return obstacle;
  }

  releaseObstacle(obstacle: Obstacle) {
    const index = this.activeObstacles.indexOf(obstacle);
    if (index > -1) {
      this.activeObstacles.splice(index, 1);
      this.pool.push(obstacle);
    }
  }

  updateActiveObstacles(deltaTime: number, speed: number) {
    for (let i = this.activeObstacles.length - 1; i >= 0; i--) {
      const obstacle = this.activeObstacles[i];
      obstacle.y = Math.round(obstacle.y + speed * deltaTime);
      if (obstacle.y > GAME_HEIGHT) {
        this.releaseObstacle(obstacle);
      }
    }
  }

  getActiveObstacles(): Obstacle[] {
    return this.activeObstacles;
  }
}

//
// Components
//
const PlayerSprite = ({
  x,
  y,
  currentAnimation,
  currentFrame,
  wall,
}: NinjaPlayer) => {
  const { url } = ANIMATIONS[currentAnimation];

  let transform = "none";
  let rotate = "0deg";
  if (currentAnimation === "run") {
    transform = wall === "left" ? `scaleY(-1)` : "none";
    rotate = "-90deg";
  } else if (currentAnimation === "hit" || currentAnimation === "fall") {
    transform = wall === "left" ? `scaleX(-1)` : "none";
  }

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        transform: transform,
        rotate: rotate,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: PLAYER_SIZE,
          height: PLAYER_SIZE,
          backgroundImage: `url('${url}')`,
          backgroundPosition: `-${currentFrame * PLAYER_SIZE}px 0px`,
          backgroundSize: "auto 100%",
          imageRendering: "pixelated",
          filter: "brightness(1.25) saturate(1.2)", // Increase brightness and saturation
        }}
      />
    </div>
  );
};

const ObstacleSprite = ({ x, y, currentFrame }: Obstacle) => {
  const { url } = ANIMATIONS.bat;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: OBSTACLE_SIZE,
        height: OBSTACLE_SIZE,
      }}
    >
      {/* Outline */}
      {[-0.5, 0.5].map((offset) => (
        <div
          key={offset}
          style={{
            position: "absolute",
            left: offset,
            top: offset,
            width: OBSTACLE_SIZE,
            height: OBSTACLE_SIZE,
            backgroundImage: `url('${url}')`,
            backgroundPosition: `-${currentFrame * OBSTACLE_SIZE}px 0px`,
            backgroundSize: "auto 100%",
            filter: "blur(1px) brightness(0) invert(1)", // White outline
          }}
        />
      ))}
      {/* Main sprite */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: OBSTACLE_SIZE,
          height: OBSTACLE_SIZE,
          imageRendering: "pixelated",
          backgroundImage: `url('${url}')`,
          backgroundPosition: `-${currentFrame * OBSTACLE_SIZE}px 0px`,
          backgroundSize: "auto 100%",
        }}
      ></div>
    </div>
  );
};

const GameScreen = ({ team }: { team: NinjaTeam }) => {
  const player = team.players[team.currentPlayerIndex];

  return (
    <div style={{ margin: 24 }}>
      <div
        style={{
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
          background: `
            linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.9)),
            url('images/ninja/bg4.jpeg') no-repeat center center
          `,
          backgroundSize: "100% 100%",
          boxShadow: "0 10px 50px -12px rgb(255 255 255 / 0.3)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          // border: '1px solid black',
          borderBottom: "none", // Connect with color bar
        }}
      >
        {/* Score display */}
        <div
          style={{
            alignSelf: "flex-end",
            margin: "8px",
            fontFamily: "Courier New",
            fontSize: 16,
            fontWeight: "bold",
            color: "white",
            zIndex: 100,
          }}
        >
          {team.players.reduce((total, player) => total + player.score, 0)}
        </div>

        {/* Game content */}
        <div style={{ flex: 1, position: "relative" }}>
          {/* Countdown overlay */}
          {team.state === "countdown" &&
            team.countdownMessage &&
            team.countdownStartTime && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  fontFamily: "Courier New",
                  fontSize: 18,
                  fontWeight: "bold",
                  color: "white",
                  textAlign: "center",
                  zIndex: 200,
                }}
              >
                <div>{team.countdownMessage}</div>
                <div style={{ fontSize: 32, marginTop: "10px" }}>
                  {Math.max(
                    0,
                    5 -
                      Math.floor((Date.now() - team.countdownStartTime) / 1000)
                  )}
                </div>
              </div>
            )}

          {team.state === "game_over" && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontFamily: "Courier New",
                fontSize: 24,
                fontWeight: "bold",
                color: "white",
              }}
            >
              GAME OVER
            </div>
          )}

          <PlayerSprite {...player} />
          {player.obstacles.map((obstacle, index) => (
            <ObstacleSprite key={index} {...obstacle} />
          ))}
        </div>
      </div>

      {/* Color bar */}
      <div
        style={{
          width: GAME_WIDTH,
          height: 32,
          backgroundColor: player.color,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          font: "14px Arvo",
          // border: `1px solid ${player.color}`,
        }}
      >
        {player.name}
      </div>
    </div>
  );
};

//
// Constants
//
const GAME_HEIGHT = 560;
const GAME_WIDTH = 320;

const OBSTACLE_SIZE = 48;
const OBSTACLE_MIN_GAP = 220;
const OBSTACLE_BAG_DEFAULT = shuffle([0, 0, 1, 1]);

const DEFAULT_OBSTACLES: Obstacle[] = [
  {
    x: 0,
    y: -2 * OBSTACLE_SIZE,
    currentFrame: 0,
    lastFrameUpdate: 0,
  },
];

// PLAYER_SIZE == width/height of the sprite character including empty space
// Hitbox calculations should use values in ANIMATIONS
const PLAYER_SIZE = 72;
const PLAYER_VX = 1.2;

const ANIMATIONS = {
  run: {
    url: "sprites/runsheet.png",
    frames: 8,
    hitbox: { xb: 12, xf: 14, yb: 0, yt: 12 },
    msPerFrame: 80,
  },
  roll: {
    url: "sprites/rollsheet.png",
    frames: 8,
    // Keep same hitbox as run
    hitbox: { xb: 12, xf: 14, yb: 0, yt: 12 },
    msPerFrame: 70,
  },
  hit: {
    url: "sprites/hitsheet.png",
    frames: 6,
    hitbox: { xb: 0, xf: 0, yb: 0, yt: 0 },
    msPerFrame: 100,
  },
  fall: {
    url: "sprites/fallsheet.png",
    frames: 3,
    hitbox: { xb: 0, xf: 0, yb: 0, yt: 0 },
    msPerFrame: 70,
  },
  bat: {
    url: "sprites/batsheet.png",
    frames: 3,
    hitbox: { xb: 4, xf: 4, yb: 4, yt: 4 },
    msPerFrame: 100,
  },
};

const DEFAULT_TEAMS: NinjaTeam[] = [
  {
    id: "1",
    name: "Lizard Wizard",
    color: Color.Blue,
    currentPlayerIndex: 0,
    state: "not_started",
    players: [
      {
        id: "hp_0sdf79",
        name: "Harry Potter",
        color: Color.Blue,
        teamId: "1",
        avatar: Avatar.Icecream,
        x: 0,
        y: GAME_HEIGHT * 0.6,
        vx: 0,
        score: 0,
        obstacles: DEFAULT_OBSTACLES,
        isGameOver: false,
        currentAnimation: "run",
        msPerFrame: ANIMATIONS.run.msPerFrame,
        wall: "left",
        currentFrame: 3, // 3 looks nicest
        lastFrameUpdate: Date.now(),
      },
      {
        id: "g_n9o87as",
        name: "Gandalf",
        color: Color.Blue,
        teamId: "1",
        avatar: Avatar.Tree,
        x: 0,
        y: GAME_HEIGHT * 0.6,
        vx: 0,
        score: 0,
        obstacles: DEFAULT_OBSTACLES,
        isGameOver: false,
        currentAnimation: "run",
        msPerFrame: ANIMATIONS.run.msPerFrame,
        wall: "left",
        currentFrame: 3, // 3 looks nicest
        lastFrameUpdate: Date.now(),
      },
    ],
  },
  {
    id: "2",
    name: "Surprise entrant",
    color: Color.Red,
    currentPlayerIndex: 0,
    state: "not_started",
    players: [
      {
        id: "blam_9dg",
        name: "Blam",
        color: Color.Red,
        teamId: "2",
        avatar: Avatar.Spikyball,
        x: 0,
        y: GAME_HEIGHT * 0.6,
        vx: 0,
        score: 0,
        obstacles: DEFAULT_OBSTACLES,
        isGameOver: false,
        currentAnimation: "run",
        msPerFrame: ANIMATIONS.run.msPerFrame,
        wall: "left",
        currentFrame: 3,
        lastFrameUpdate: Date.now(),
      },
    ],
  },
];

//
// Game
//
const NinjaRun = () => {
  useListenNavigate("host");
  useAdminAuth({ claimHost: true });
  const { subscribe, unsubscribe } = useWebSocketContext();
  const playSound = useWebAudio();
  const [, setRenderTrigger] = useState({});
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  const gameState = useRef<GameState>({
    // Same obstacles used for all teams. team.obstacles is usually a reference to the list in the pool
    teams: [],
    obstaclePoolsByPlayerIndex: [],
    speed: 0.15,
    // Ensure we don't choose the same side for new obstacles too many times in a row
    obstacleBag: [...OBSTACLE_BAG_DEFAULT],
    lastTick: 0,
    phase: "not_started",
    // Set when start game button is pressed
    gameStartTime: 0,
    speedUpdateAccumulator: 0,
    playerIdToTeamIdMap: {},
  });

  // Get teams from backend
  useEffect(() => {
    const state = gameState.current;

    if (DEBUG) {
      state.teams = structuredClone(DEFAULT_TEAMS);
      state.playerIdToTeamIdMap = {
        hp_0sdf79: "1",
        g_n9o87as: "1",
        blam_9dg: "2",
      };
      setLoadingPlayers(false);
      return;
    }

    Promise.all([apiFetch(APIRoute.ListTeams), apiFetch(APIRoute.ListPlayers)])
      .then(([{ teams: ts }, { players: ps }]) => {
        const teamIdToPlayerMap: Record<string, Player[]> = {};
        for (const player of ps) {
          if (!(player.teamId in teamIdToPlayerMap)) {
            teamIdToPlayerMap[player.teamId] = [];
          }
          teamIdToPlayerMap[player.teamId].push(player);
        }

        for (const team of ts) {
          const teamPlayers = teamIdToPlayerMap[team.id];
          state.teams.push({
            id: team.id,
            name: team.name,
            color: team.color,
            currentPlayerIndex: 0,
            state: "not_started",
            players: teamPlayers.map((player) => ({
              id: player.id,
              name: player.name,
              color: team.color,
              teamId: team.id,
              avatar: player.avatar,
              x: 0,
              y: GAME_HEIGHT * 0.6,
              vx: 0,
              score: 0,
              obstacles: [],
              isGameOver: false,
              currentAnimation: "run",
              msPerFrame: ANIMATIONS.run.msPerFrame,
              wall: "left",
              currentFrame: 0,
              lastFrameUpdate: Date.now(),
            })),
          });
        }

        const playerIdToTeamIdMap: Record<string, string> = {};
        for (const player of ps) {
          playerIdToTeamIdMap[player.id] = player.teamId;
        }
        state.playerIdToTeamIdMap = playerIdToTeamIdMap;

        setLoadingPlayers(false);
      })
      .catch((err: any) => console.error(err));
  }, []);

  const start = useCallback(() => {
    // Calculate max players across all teams to know how many obstacle pools we need
    const maxPlayersInAnyTeam = Math.max(
      ...gameState.current.teams.map((team) => team.players.length)
    );

    gameState.current = {
      teams: gameState.current.teams.map((team) => ({
        ...team,
        currentPlayerIndex: 0,
        state: "playing",
        players: team.players.map((player) => ({
          ...player,
          x: 0,
          y: GAME_HEIGHT * 0.6,
          vx: 0,
          score: 0,
          obstacles: [],
          isGameOver: false,
          currentAnimation: "run",
          msPerFrame: ANIMATIONS.run.msPerFrame,
          wall: "left",
          currentFrame: 0,
          lastFrameUpdate: Date.now(),
        })),
      })),
      obstaclePoolsByPlayerIndex: Array(maxPlayersInAnyTeam)
        .fill(null)
        .map(() => new ObstaclePool(20)),
      speed: 0.15,
      obstacleBag: [...OBSTACLE_BAG_DEFAULT],
      lastTick: 0,
      phase: "in_progress",
      gameStartTime: Date.now(),
      speedUpdateAccumulator: 0,
      playerIdToTeamIdMap: gameState.current.playerIdToTeamIdMap,
    };

    playSound("ninja");
  }, [playSound]);

  useEffect(() => {
    // Preload images to avoid flickering
    for (const animation of Object.values(ANIMATIONS)) {
      const img = new Image();
      img.src = animation.url;
    }
  }, []);

  const updateGameSpeed = useCallback((deltaTime: number) => {
    const state = gameState.current;

    if (state.phase !== "in_progress") {
      return;
    }

    // Gradually increase the speed of the obstacles
    state.speedUpdateAccumulator += deltaTime;
    if (state.speedUpdateAccumulator >= 500) {
      const intervals = Math.floor(state.speedUpdateAccumulator / 500);
      // Update the speed based on the number of intervals passed
      state.speed *= Math.pow(1.015, intervals);
      state.speedUpdateAccumulator -= intervals * 500;

      for (const team of state.teams) {
        // Only update teams that are currently playing
        if (team.state !== "playing") {
          continue;
        }

        const player = team.players[team.currentPlayerIndex];
        // Increase running speed
        player.msPerFrame -= 0.15;
      }
    }
  }, []);

  const updateObstacles = useCallback((deltaTime: number) => {
    const state = gameState.current;
    const now = Date.now();

    // Don't update obstacles if game hasn't started
    if (state.phase === "not_started") {
      return;
    }

    // Don't update obstacles if all teams are game over
    let isGameOverForAll = true;
    for (const team of state.teams) {
      if (team.state === "playing" || team.state === "countdown") {
        isGameOverForAll = false;
        break;
      }
    }
    if (isGameOverForAll) {
      state.phase = "game_over";
      return;
    }

    // Don't spawn or update obstacles for the first few seconds
    if (now - state.gameStartTime < 1500) {
      return;
    }

    // Get set of currently active player indices across all teams
    const activePlayerIndices = new Set<number>();
    for (const team of state.teams) {
      if (team.state === "playing") {
        activePlayerIndices.add(team.currentPlayerIndex);
      }
    }

    // Only update obstacle pools that are currently being used by active players
    for (const playerIndex of activePlayerIndices) {
      const pool = state.obstaclePoolsByPlayerIndex[playerIndex];
      pool.updateActiveObstacles(deltaTime, state.speed);
      const activeObstacles = pool.getActiveObstacles();

      if (
        activeObstacles.length === 0 ||
        activeObstacles[activeObstacles.length - 1].y > OBSTACLE_MIN_GAP
      ) {
        const x = state.obstacleBag.pop()! * (GAME_WIDTH - OBSTACLE_SIZE);
        if (state.obstacleBag.length === 0) {
          state.obstacleBag = shuffle([...OBSTACLE_BAG_DEFAULT]);
        }

        pool.getObstacle(x, -Math.random() * OBSTACLE_MIN_GAP * 0.6);
      }

      // Update animation frame
      for (const obstacle of activeObstacles) {
        if (obstacle.lastFrameUpdate + ANIMATIONS.bat.msPerFrame < now) {
          obstacle.currentFrame =
            (obstacle.currentFrame + 1) % ANIMATIONS.bat.frames;
          obstacle.lastFrameUpdate = now;
        }
      }
    }

    // Live players reference the same obstacles list to reduce memory allocations and GC pauses
    for (const team of state.teams) {
      const player = team.players[team.currentPlayerIndex];
      if (team.state === "playing" && !player.isGameOver) {
        player.obstacles =
          state.obstaclePoolsByPlayerIndex[
            team.currentPlayerIndex
          ].getActiveObstacles();
      } else {
        // Keep animating the obstacles for the game over players
        for (const obstacle of player.obstacles) {
          if (obstacle.lastFrameUpdate + ANIMATIONS.bat.msPerFrame < now) {
            obstacle.currentFrame =
              (obstacle.currentFrame + 1) % ANIMATIONS.bat.frames;
            obstacle.lastFrameUpdate = now;
          }
        }
      }
    }
  }, []);

  const handlePlayerDeath = useCallback(
    (team: NinjaTeam, deadPlayer: NinjaPlayer) => {
      // Check if there are more players available
      if (team.currentPlayerIndex + 1 < team.players.length) {
        // index will be incremented in updateCountdowns
        const nextPlayer = team.players[team.currentPlayerIndex + 1];
        team.state = "countdown";
        team.countdownStartTime = Date.now();
        team.countdownMessage = `${deadPlayer.name} has perished. ${nextPlayer.name} will begin in`;
      } else {
        // No more players - team is game over
        team.state = "game_over";
      }
    },
    []
  );

  const updatePlayers = useCallback(
    (deltaTime: number) => {
      const state = gameState.current;
      const now = Date.now();

      // Don't update players if game hasn't started
      // 'game_over' phase is handle implicitly
      if (state.phase === "not_started") {
        return;
      }

      for (const team of state.teams) {
        // Only update teams that are currently playing, in countdown, or game over (for death animations)
        if (team.state === "not_started") {
          continue;
        }

        const player = team.players[team.currentPlayerIndex];

        if (player.isGameOver) {
          // NinjaPlayer has fallen off the screen
          if (player.y > GAME_HEIGHT) {
            continue;
          }

          if (
            player.currentAnimation === "hit" &&
            player.currentFrame < ANIMATIONS.hit.frames - 1
          ) {
            const targetX = (GAME_WIDTH - PLAYER_SIZE) / 2;
            const moveDistance = deltaTime * 0.2;
            if (player.x < targetX) {
              player.x = Math.min(player.x + moveDistance, targetX);
            } else if (player.x > targetX) {
              player.x = Math.max(player.x - moveDistance, targetX);
            }

            // Update hit animation frame
            if (now - player.lastFrameUpdate > ANIMATIONS.hit.msPerFrame) {
              player.currentFrame++;
              player.lastFrameUpdate = now;
            }
          }

          // Switch to fall animation when hit animation is done
          if (
            player.currentAnimation === "hit" &&
            player.currentFrame === ANIMATIONS.hit.frames - 1
          ) {
            player.currentAnimation = "fall";
            player.currentFrame = 0;
            player.lastFrameUpdate = Date.now();
          }

          // Fall animation
          if (player.currentAnimation === "fall") {
            player.y += 0.15 * deltaTime;

            // Update fall animation frame
            const now = Date.now();
            if (now - player.lastFrameUpdate > ANIMATIONS.fall.msPerFrame) {
              player.currentFrame =
                (player.currentFrame + 1) %
                ANIMATIONS[player.currentAnimation].frames;
              player.lastFrameUpdate = now;
            }
          }

          continue;
        }

        // Skip gameplay updates if team is in countdown or game over state
        if (team.state === "countdown" || team.state === "game_over") {
          continue;
        }

        // Calculate the new position
        let newX = Math.round(player.x + player.vx * deltaTime);

        // Check for collisions with left and right walls
        if (newX < 0) {
          newX = 0;
          player.vx = 0; // Stop the player at the left wall
        } else if (newX + PLAYER_SIZE > GAME_WIDTH) {
          newX = GAME_WIDTH - PLAYER_SIZE;
          player.vx = 0; // Stop the player at the right wall
        }

        // Check for collisions with obstacles
        let isColliding = false;
        for (const obstacle of player.obstacles) {
          const { xb, xf, yb, yt } = ANIMATIONS[player.currentAnimation].hitbox;
          const oBox = ANIMATIONS.bat.hitbox;
          if (
            // right edge of player is to the right of the left edge of obstacle
            player.x + PLAYER_SIZE - xb > obstacle.x + oBox.xb &&
            // left edge of player is to the left of the right edge of obstacle
            player.x + xf < obstacle.x + OBSTACLE_SIZE - oBox.xf &&
            // bottom edge of player is below the top edge of obstacle
            player.y + PLAYER_SIZE - yb > obstacle.y + oBox.yt &&
            // top edge of player is above the bottom edge of obstacle
            player.y + yt < obstacle.y + OBSTACLE_SIZE - oBox.yb
          ) {
            isColliding = true;
            break;
          }
        }

        if (isColliding) {
          // Copy a snapshot of the obstacles list
          player.obstacles = structuredClone(
            state.obstaclePoolsByPlayerIndex[
              team.currentPlayerIndex
            ].getActiveObstacles()
          );
          player.isGameOver = true;
          player.currentAnimation = "hit";
          player.currentFrame = 0;
          player.lastFrameUpdate = Date.now();
          player.vx = 0; // Stop horizontal movement

          // Handle relay transition
          handlePlayerDeath(team, player);
          continue;
        }

        // Update player position
        player.x = newX;

        if (player.x === 0) {
          player.wall = "left";
          player.currentAnimation = "run";
        } else if (player.x + PLAYER_SIZE === GAME_WIDTH) {
          player.wall = "right";
          player.currentAnimation = "run";
        } else {
          player.wall = "none";
          player.currentAnimation = "roll";
        }

        // Update animation frame
        if (player.lastFrameUpdate + player.msPerFrame < now) {
          const currentFrame =
            (player.currentFrame + 1) %
            ANIMATIONS[player.currentAnimation].frames;

          // Also update the score here to avoid another date.now call
          player.score += Math.round(
            Math.max(0, now - player.lastFrameUpdate) / 100
          );
          player.currentFrame = currentFrame;
          player.lastFrameUpdate = now;
        }
      }
    },
    [handlePlayerDeath]
  );

  // On button press, change the player's direction
  const handleJump = useCallback((playerId: string) => {
    const teamId = gameState.current.playerIdToTeamIdMap[playerId];
    console.log("teamId", teamId);
    let team: NinjaTeam | null = null;
    for (const t of gameState.current.teams) {
      if (t.id === teamId) {
        team = t;
        break;
      }
    }
    if (!team) {
      return;
    }

    // if team is not in playing state, do nothing
    if (team.state !== "playing") {
      return;
    }

    // if this player is not the active player, do nothing
    const playerIndex = team.players.findIndex((p) => p.id === playerId);
    if (playerIndex !== team.currentPlayerIndex) {
      return;
    }

    const player = team.players[team.currentPlayerIndex];

    // if game over, do nothing
    if (player.isGameOver) {
      return;
    }

    let newVx = 0;
    // if the player is already flipping, change direction
    if (player.vx !== 0) {
      newVx = -player.vx;
    }
    // if the player is on the left side of the screen, move right
    else if (player.x === 0) {
      newVx = PLAYER_VX;
    }
    // otherwise (player on the right side of the screen), move left
    else {
      newVx = -PLAYER_VX;
    }

    player.vx = newVx;
  }, []);

  // Listen for buzzer presses
  useEffect(() => {
    if (DEBUG) {
      // When running in debug mode, skip WebSocket integration
      return;
    }

    subscribe(Channel.BUZZER, (message: WebSocketMessage) => {
      if (message.messageType === MessageType.BUZZ) {
        handleJump(message.payload.playerId);
      }
    });

    return () => {
      unsubscribe(Channel.BUZZER);
    };
  }, [handleJump, subscribe, unsubscribe]);

  // Button press event listener
  useEffect(() => {
    const keydownHandler = (event: KeyboardEvent) => {
      switch (event.code) {
        case "KeyA":
          handleJump("hp_0sdf79");
          break;
        case "KeyQ":
          handleJump("g_n9o87as");
          break;
        case "KeyS":
          handleJump("blam_9dg");
          break;
      }
    };

    addEventListener("keydown", keydownHandler);
    return () => {
      removeEventListener("keydown", keydownHandler);
    };
  }, [handleJump]);

  const updateCountdowns = useCallback(() => {
    const state = gameState.current;
    const now = Date.now();

    for (const team of state.teams) {
      if (team.state === "countdown" && team.countdownStartTime) {
        const elapsed = now - team.countdownStartTime;
        if (elapsed >= 5000) {
          // Countdown finished - switch to next player
          team.currentPlayerIndex++;
          team.state = "playing";

          // Reset game speed to initial value for the new player
          state.speed = 0.15;
          state.speedUpdateAccumulator = 0;

          // Reset the new player
          const newPlayer = team.players[team.currentPlayerIndex];
          newPlayer.x = 0;
          newPlayer.y = GAME_HEIGHT * 0.6;
          newPlayer.vx = 0;
          newPlayer.score = 0;
          newPlayer.obstacles = [];
          newPlayer.isGameOver = false;
          newPlayer.currentAnimation = "run";
          newPlayer.msPerFrame = ANIMATIONS.run.msPerFrame;
          newPlayer.wall = "left";
          newPlayer.currentFrame = 3;
          newPlayer.lastFrameUpdate = Date.now();

          // Clear countdown data
          team.countdownStartTime = undefined;
          team.countdownMessage = undefined;
        }
      }
    }
  }, []);

  // Game loop, runs every frame
  const gameLoop = useCallback(
    (deltaTime: number) => {
      updateGameSpeed(deltaTime);
      updateObstacles(deltaTime);
      updatePlayers(deltaTime);
      updateCountdowns();
    },
    [updateGameSpeed, updatePlayers, updateObstacles, updateCountdowns]
  );

  // Scaffolding for the game loop
  useEffect(() => {
    let animationFrameId: number;

    const physicsProcess = (time: DOMHighResTimeStamp) => {
      const state = gameState.current;
      if (state.lastTick !== 0) {
        const deltaTime = time - state.lastTick;
        // Using deltaTime makes physics frame rate independent
        gameLoop(deltaTime);
        setRenderTrigger({});
      }

      state.lastTick = time;
      animationFrameId = requestAnimationFrame(physicsProcess);
    };

    animationFrameId = requestAnimationFrame(physicsProcess);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameLoop]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen
        bg-[url('/images/ninja/darkclouds.png')] bg-no-repeat bg-cover bg-center"
    >
      <div className="flex">
        {gameState.current.teams.map((team, index) => (
          <GameScreen key={index} team={team} />
        ))}
      </div>
      <div>
        <button
          className="text-sm px-3 py-1 mb-0 mt-2 bg-white text-black"
          style={{
            visibility:
              gameState.current.phase === "in_progress" ? "hidden" : "visible",
          }}
          disabled={loadingPlayers}
          onClick={() => start()}
        >
          {gameState.current.phase === "not_started" ? "Start" : "Play again"}
        </button>
      </div>
    </div>
  );
};

export default NinjaRun;
