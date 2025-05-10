import { serve } from "bun";
import index from "../client/index.html";
import { codenamesGame } from "./codenames";

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/codenames/start": {
      async GET(req) {
        codenamesGame.startGame();
        return Response.json({
          state: codenamesGame.getGameState(),
        });
      },
    },

    "/api/codenames/state": {
      async GET(req) {
        return Response.json({
          state: codenamesGame.getGameState(),
        });
      },
    },

    "/api/codenames/clue": {
      async POST(req) {
        const { clueWord, clueNumber } = await req.json();
        const state = await codenamesGame.submitClue(clueWord, clueNumber);
        return Response.json({
          state,
        });
      },
    },

    "/api/codenames/guess": {
      async POST(req) {
        const { word } = await req.json();
        try {
          const state = codenamesGame.submitGuess(word);
          return Response.json({
            state,
          });
        } catch (error: any) {
          return Response.json(
            {
              error: error.message,
              state: codenamesGame.getGameState(),
            },
            { status: 400 }
          );
        }
      },
    },

    "/api/codenames/end-turn": {
      async POST(req) {
        try {
          const state = codenamesGame.endTurn();
          return Response.json({
            state,
          });
        } catch (error: any) {
          return Response.json(
            {
              error: error.message,
              state: codenamesGame.getGameState(),
            },
            { status: 400 }
          );
        }
      },
    },

    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async (req) => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },

  hostname: "0.0.0.0",
  port: 3001,
});
