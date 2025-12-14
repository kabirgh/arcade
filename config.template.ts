export default {
  // The mode determines how players connect to the game
  // "local" - Players connect via local WiFi network to your IP address directly
  // "internet" - Players connect via the internet to a HTTPS domain
  mode: "local" as "local" | "internet",

  // Local network configuration
  // Used when mode is "local"
  local: {
    // These are used to generate QR codes for players to connect to the WiFi and join the game.
    // The server should be on the same network as the players
    wifi: {
      ssid: "your-wifi-name",
      password: "your-wifi-password",
    },
    // Server configuration for local network
    server: {
      // The IP address of the computer where you're running the application.
      // I recommend setting up a static IP address for the server using your router's admin panel.
      host: "192.168.1.224",
      // In production, the game will be available at http://{server.host}:{server.port}
      port: 3001,
    },
    // Development server configuration
    vite: {
      // In development mode, the game will be available at http://localhost:{port}
      port: 5173,
    },
  },

  // Internet configuration
  // Used when mode is "internet"
  internet: {
    // Your domain name pointing to this server
    domain: "arcade.yourdomain.com",
    // The port to listen on (443 is standard for HTTPS)
    port: 443,
    // TLS certificate paths for HTTPS
    tls: {
      // Path to the full certificate chain file
      certPath: "./certs/fullchain.pem",
      // Path to the private key file
      keyPath: "./certs/privkey.pem",
    },
  },

  // Admin panel configuration
  admin: {
    // The password to access the admin panel and host pages
    password: "bonk123",
  },
  // When set to true and using `bun dev`, the arcade games will be played with dummy players.
  // Ignored in production
  gameDebug: true,
};
