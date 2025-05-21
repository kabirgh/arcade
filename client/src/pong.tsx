import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import { APIRoute } from "../../shared/types/api/schema";
import { Avatar, Color } from "../../shared/types/domain/player";
import usePongAudio from "./hooks/usePongAudio";
import { apiFetch } from "./util/apiFetch";

const DEBUG = true;

type Position = "left" | "right" | "top" | "bottom";

type PongPlayer = {
  x: number;
  y: number;
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
    id: "top_1",
    name: "top",
    avatar: Avatar.Icecream,
    teamId: "1",
    position: "top",
  },
  {
    x: POSITION_TO_DEFAULT_XY.bottom.x,
    y: POSITION_TO_DEFAULT_XY.bottom.y,
    id: "bottom_1",
    name: "bottom",
    avatar: Avatar.Book,
    teamId: "2",
    position: "bottom",
  },
  {
    x: POSITION_TO_DEFAULT_XY.left.x,
    y: POSITION_TO_DEFAULT_XY.left.y,
    id: "left_1",
    name: "left",
    avatar: Avatar.Cap,
    teamId: "3",
    position: "left",
  },
  {
    x: POSITION_TO_DEFAULT_XY.right.x,
    y: POSITION_TO_DEFAULT_XY.right.y,
    id: "right_1",
    name: "right",
    avatar: Avatar.Bulb,
    teamId: "4",
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

// 1-4 teams. Each team can have multiple players. Each player has their own mini-paddle.
const Quadrapong = () => {
  // const [, setLocation] = useLocation();
  const playSound = usePongAudio();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [startingLives, setStartingLives] = useState(STARTING_LIVES);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
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

  // Get teams & players from backend
  useEffect(() => {
    if (DEBUG) {
      stateRef.current.teams = structuredClone(DEFAULT_TEAMS);
      stateRef.current.players = structuredClone(DEFAULT_PLAYERS);
      setLoadingPlayers(false);
      console.log("Loaded default teams", stateRef.current.teams);
      console.log("Loaded default players", stateRef.current.players);
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
            // TODO space paddles correctly
            x: defaultPosition.x,
            y: defaultPosition.y,
            position: defaultPosition.position,
          };
        });
        setLoadingPlayers(false);
        console.log("Loaded players", stateRef.current.players);
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  // If user changes the starting lives, update the teams
  // It should be impossible to change the starting lives while the game is running
  useEffect(() => {
    const { teams } = stateRef.current;
    for (const team of teams) {
      team.lives = startingLives;
    }
  }, [startingLives]);

  const handleTeamPaddleCollision = useCallback(
    (
      ball: Ball,
      playersOfTeamAtPosition: PongPlayer[],
      teamPosition: "left" | "right" | "top" | "bottom",
      playSound: (sound: string) => void
    ) => {
      const hitPaddles: PongPlayer[] = [];
      const [ballLeft, ballRight, ballTop, ballBottom] = [
        ball.x,
        ball.x + BALL_SIZE,
        ball.y,
        ball.y + BALL_SIZE,
      ];

      for (const player of playersOfTeamAtPosition) {
        let [pl, pr, pt, pb] = [
          player.x,
          player.x +
            (teamPosition === "left" || teamPosition === "right"
              ? PADDLE_THICKNESS
              : PADDLE_LENGTH),
          player.y,
          player.y +
            (teamPosition === "left" || teamPosition === "right"
              ? PADDLE_LENGTH
              : PADDLE_THICKNESS),
        ];

        // Consider collision extension for individual paddle check
        if (teamPosition === "left") pl -= COLLISION_EXTENSION;
        else if (teamPosition === "right") pr += COLLISION_EXTENSION;
        else if (teamPosition === "top") pt -= COLLISION_EXTENSION;
        else if (teamPosition === "bottom") pb += COLLISION_EXTENSION;

        if (
          ballBottom > pt &&
          ballTop < pb &&
          ballRight > pl &&
          ballLeft < pr
        ) {
          hitPaddles.push(player);
        }
      }

      if (hitPaddles.length === 0) {
        return false; // No paddles from this team were hit
      }

      // Determine effective paddle surface from hitPaddles
      let effectivePaddleMin: number, effectivePaddleMax: number;
      let paddleLineCoordinate: number;

      if (teamPosition === "left" || teamPosition === "right") {
        effectivePaddleMin = Math.min(...hitPaddles.map((p) => p.y));
        effectivePaddleMax = Math.max(
          ...hitPaddles.map((p) => p.y + PADDLE_LENGTH)
        );
        paddleLineCoordinate = hitPaddles[0].x; // All paddles in a vertical team share the same x base
      } else {
        // Top or Bottom
        effectivePaddleMin = Math.min(...hitPaddles.map((p) => p.x));
        effectivePaddleMax = Math.max(
          ...hitPaddles.map((p) => p.x + PADDLE_LENGTH)
        );
        paddleLineCoordinate = hitPaddles[0].y; // All paddles in a horizontal team share the same y base
      }

      const effectivePaddleSpan = effectivePaddleMax - effectivePaddleMin;

      // Reset ball to 'front' of the effective paddle surface
      // This uses the original paddle line, not the COLLISION_EXTENSION version for reset
      if (teamPosition === "left") {
        ball.x = paddleLineCoordinate + PADDLE_THICKNESS;
      } else if (teamPosition === "right") {
        ball.x = paddleLineCoordinate - BALL_SIZE;
      } else if (teamPosition === "top") {
        ball.y = paddleLineCoordinate + PADDLE_THICKNESS;
      } else if (teamPosition === "bottom") {
        ball.y = paddleLineCoordinate - BALL_SIZE;
      }

      // Calculate the collision point on the effective surface
      let rawCollisionPoint: number;
      if (teamPosition === "left" || teamPosition === "right") {
        rawCollisionPoint =
          (ball.y + BALL_SIZE / 2 - effectivePaddleMin) / effectivePaddleSpan;
      } else {
        // Top or Bottom
        rawCollisionPoint =
          (ball.x + BALL_SIZE / 2 - effectivePaddleMin) / effectivePaddleSpan;
      }

      // Normalize collision point to [-1, 1]
      const normalizedCollisionPoint = Math.max(
        -1,
        Math.min(1, rawCollisionPoint * 2 - 1)
      );

      // Calculate new angle (up to 75 degrees)
      const maxAngle = (Math.PI * 5) / 12; // 75 degrees
      const newAngle =
        normalizedCollisionPoint *
        maxAngle *
        (teamPosition === "left" || teamPosition === "right" ? -1 : 1);

      const speed = SPEED_MULTIPLIER * Math.sqrt(ball.dx ** 2 + ball.dy ** 2);

      // Update ball direction based on which paddle was hit
      if (teamPosition === "left" || teamPosition === "right") {
        ball.dx =
          speed * Math.cos(newAngle) * (teamPosition === "left" ? 1 : -1);
        ball.dy = speed * -Math.sin(newAngle);
      } else {
        // Top or Bottom
        ball.dx = speed * Math.sin(newAngle);
        ball.dy =
          speed * Math.cos(newAngle) * (teamPosition === "top" ? 1 : -1);
      }

      playSound("paddle");
      return true; // Collision occurred
    },
    [] // Dependencies like PADDLE_THICKNESS, PADDLE_LENGTH etc are constants
  );

  const handleWallCollision = useCallback(
    (ball: Ball, wall: Wall, playSound: (sound: string) => void) => {
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
    []
  );

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

      // Move players
      // if (!DEBUG) {
      //   // ReadControllers().then((json) => {
      //   //   const controllers = JSON.parse(json);
      //   //
      //   //   for (const /*[position, player]*/ player of players) { // Iterate over players array
      //   //     // const controller = controllers[player.buzzerId]; // player.buzzerId does not exist
      //   //     // if (!controller) continue;
      //   //
      //   //     // Determine position from player object
      //   //     const position = player.position;
      //   //
      //   //     if (position === "left" || position === "right") {
      //   //       // const dy = -controller.LeftJoystick.Y || 0; // invert Y axis
      //   //       const dy = 0; // Placeholder
      //   //       player.y = Math.max(
      //   //         PADDLE_STOP,
      //   //         Math.min(
      //   //           CANVAS_SIZE - PADDLE_LENGTH - PADDLE_STOP,
      //   //           player.y + dy * deltaTime * JOYSTICK_SENSITIVITY
      //   //         )
      //   //       );
      //   //     } else {
      //   //       // const dx = controller.LeftJoystick.X || 0;
      //   //       const dx = 0; // Placeholder
      //   //       player.x = Math.max(
      //   //         PADDLE_STOP,
      //   //         Math.min(
      //   //           CANVAS_SIZE - PADDLE_LENGTH - PADDLE_STOP,
      //   //           player.x + dx * deltaTime * JOYSTICK_SENSITIVITY
      //   //         )
      //   //       );
      //   //     }
      //   //   }
      //   // });
      // }

      // Update ball position
      ball.x += ball.dx * deltaTime;
      ball.y += ball.dy * deltaTime;

      const [bl, br, bt, bb] = [
        ball.x,
        ball.x + BALL_SIZE,
        ball.y,
        ball.y + BALL_SIZE,
      ];

      // Collision with paddles
      for (const team of teams) {
        if (team.lives <= 0 || team.type === "dummy") {
          continue;
        }

        const playersOfTeamAtPosition = players.filter(
          (p) => p.teamId === team.id && p.position === team.position
        );

        if (playersOfTeamAtPosition.length > 0) {
          if (
            handleTeamPaddleCollision(
              ball,
              playersOfTeamAtPosition,
              team.position,
              playSound
            )
          ) {
            return; // Collision handled for this frame
          }
        }
      }

      // Collision with walls
      for (const wall of walls) {
        if (handleWallCollision(ball, wall, playSound)) {
          return;
        }
      }

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
          const randomAngle = Math.random() * Math.PI * 2;
          ball.dx = INITIAL_BALL_SPEED * Math.sin(randomAngle);
          ball.dy = INITIAL_BALL_SPEED * Math.cos(randomAngle);
        }, 0);
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
          ctx.fillRect(player.x, player.y, PADDLE_THICKNESS, PADDLE_LENGTH);
        } else {
          ctx.fillRect(player.x, player.y, PADDLE_LENGTH, PADDLE_THICKNESS);
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
  ]);

  const start = useCallback(() => {
    const state = stateRef.current;

    // Reset teams lives and type for a new game
    const newTeams = structuredClone(DEFAULT_TEAMS);
    for (const team of newTeams) {
      team.lives = startingLives;
    }

    // Reset players to their initial positions based on their designated 'position'
    const newPlayers = structuredClone(DEFAULT_PLAYERS).map((p) => {
      return {
        ...p,
        x: POSITION_TO_DEFAULT_XY[p.position].x,
        y: POSITION_TO_DEFAULT_XY[p.position].y,
      };
    });

    stateRef.current = {
      ...state, // Keep lastTick, etc.
      phase: "in_progress",
      walls: structuredClone(DEFAULT_WALLS),
      teams: newTeams,
      players: newPlayers,
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
  }, [makeWall, startingLives, initialAngle]);

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
          disabled={loadingPlayers}
          onClick={() => start()}
        >
          {stateRef.current.phase === "not_started" ? "Start" : "Play again"}
        </button>
      </div>
    </div>
  );
};

export default Quadrapong;
