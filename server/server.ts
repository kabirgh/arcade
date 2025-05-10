import { serve } from "bun";
import index from "../client/index.html";
import { shuffle } from "../shared/utils";

const words = await Bun.file("client/codenames/words.txt").text();

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/codenames/words": {
      async GET(req) {
        const allWords: string[] = words.split(/\n/).filter(Boolean);
        const shuffledWords = shuffle(allWords);
        return Response.json({
          words: shuffledWords.slice(0, 25),
        });
      },
    },

    "/api/codenames/guess": {
      async POST(req) {
        const { words, team, clueWord, clueNumber } = await req.json();
        return Response.json({
          words,
          team,
          clueWord,
          clueNumber,
        });
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
