export default {
  wifi: {
    // These are used to generate QR codes for players to connect to the WiFi and join the game.
    // The server should be on the same network as the players
    ssid: "your-wifi-name",
    password: "your-wifi-password",
  },
  server: {
    // The IP address of the server (i.e. the computer where you're running this).
    // I recommend setting up a static IP address for the server using your router's admin panel.
    host: "192.168.1.244",
    // In production, the game will be available at http://{server.host}:{server.port}
    port: 3001,
  },
  vite: {
    // In development mode, the game will be available at http://localhost:{vite.port}
    port: 5173,
  },
  admin: {
    // The password to access the admin panel and host pages
    password: "bonk123",
  },
  // When set to true and using `bun dev`, the arcade games will be played with dummy players.
  // Ignored in production
  gameDebug: true,
};
