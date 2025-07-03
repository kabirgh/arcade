import ws from "k6/ws";
import { Trend, Counter } from "k6/metrics";

/*
  k6 load test for Arcade's WebSocket joystick path.

  – 1 host connection (claims host role)
  – 50 player connections
  – Each player sends a Channel.JOYSTICK / MessageType.MOVE packet at 60 Hz.
  – Every packet contains a monotonic seq and a millisecond timestamp.  The
    server forwards it to the host, which records latency (hostRecvTs – sentAt)
    and detects gaps for packet-loss.

  To run:
    k6 run load-tests/joystick_k6.js
  Adjust WS_URL if server differs.
*/

const WS_URL = __ENV.WS_URL || "ws://172.21.181.89:3001/ws"; // override via env
const PLAYERS = 50;
const SEND_INTERVAL_MS = 1000 / 60; // 60 Hz
export const options = {
  scenarios: {
    host: {
      executor: "constant-vus",
      exec: "hostScenario",
      vus: 1,
      duration: "30s",
    },
    players: {
      executor: "constant-vus",
      exec: "playerScenario",
      vus: PLAYERS,
      duration: "30s",
      // Start slightly after host to make sure host is ready.
      startTime: "2s",
    },
  },
  thresholds: {
    joystick_latency_ms: ["p(99)<50"], // p99 under 50 ms
    joystick_packet_loss: ["count==0"], // zero drops
  },
};

// Custom metrics
export const latencyTrend = new Trend("joystick_latency_ms", true);
export const lostPackets = new Counter("joystick_packet_loss");

// Helpers shared across VUs (each VU gets its own copy)
function claimHost(socket) {
  const msg = {
    channel: "ADMIN",
    messageType: "CLAIM_HOST",
  };
  socket.send(JSON.stringify(msg));
}

function sendJoin(socket, playerId, playerName) {
  const msg = {
    channel: "PLAYER",
    messageType: "JOIN",
    payload: {
      id: playerId,
      name: playerName,
      color: "#ffffff", // minimal fields; adjust if server expects more
    },
  };
  socket.send(JSON.stringify(msg));
}

// ---------------- Host scenario ----------------
export function hostScenario() {
  ws.connect(WS_URL, { tags: { role: "host" } }, function (socket) {
    const lastSeqPerPlayer = {};

    socket.on("open", function () {
      claimHost(socket);
    });

    socket.on("message", function (data) {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch (e) {
        return;
      }
      if (msg.channel === "JOYSTICK" && msg.messageType === "MOVE") {
        const { playerId, seq, sentAt } = msg.payload || {};
        if (typeof seq === "number" && typeof sentAt === "number") {
          // Latency = time host received minus timestamp embedded by player
          latencyTrend.add(Date.now() - sentAt);

          // Packet-loss detection
          const lastSeq = lastSeqPerPlayer[playerId];
          if (lastSeq !== undefined && seq > lastSeq + 1) {
            lostPackets.add(seq - lastSeq - 1);
          }
          lastSeqPerPlayer[playerId] = seq;
        }
      }
    });

    socket.setTimeout(function () {
      socket.close();
    }, 30000); // close after 30 s

    socket.on("close", function () {});
    socket.on("error", function () {});
  });
}

// ---------------- Player scenario ----------------
export function playerScenario() {
  const playerId = `p${__VU}`;
  const playerName = `Player-${__VU}`;

  ws.connect(WS_URL, { tags: { role: "player" } }, function (socket) {
    let seq = 0;

    socket.on("open", function () {
      sendJoin(socket, playerId, playerName);

      // Send joystick MOVE every ~16 ms (60 Hz)
      socket.setInterval(function () {
        const now = Date.now();
        const msg = {
          channel: "JOYSTICK",
          messageType: "MOVE",
          payload: {
            playerId,
            angle: Math.random() * 2 * Math.PI,
            force: Math.random(),
            seq: seq++,
            sentAt: now,
          },
        };
        socket.send(JSON.stringify(msg));
      }, SEND_INTERVAL_MS);
    });

    socket.setTimeout(function () {
      socket.close();
    }, 30000); // run for 30 s

    socket.on("error", function (e) {
      /* ignore for now */
    });
  });
}
