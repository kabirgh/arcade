# Arcade

Arcade is an application to help run game nights at home. It supports up to 24 players divided into 2-4 teams. Each player uses their phone as a controller, connecting via your local WiFi network.

TODO screenshot

### Buzzer rounds
See who can buzz in first to answer questions.

TODO video

### Multiplayer arcade games
Get everyone involved in multiplayer games.

**Pong**
Each player controls a mini-paddle to hit the ball.

TODO video

**Boat game**

TODO video and rename

**Ninja run**
Avoid obstacles as the course speeds up.

TODO video

> [!NOTE]
> Arcade does not have production-grade security. I use this to host game nights for friends - you shouldn't expose this to the internet.


## Installation & setup

### Prerequisites
- The [Bun](https://bun.sh) javascript runtime
- A WiFi network where you have admin access to the router (for eg. your home WiFi)
- A computer to run the server
- A display device (TV/projector) for the main game screen
- Mobile phones for players

### Instructions
1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/kabirgh/arcade.git
   cd arcade
   bun install
   ```

1. **Set up configuration:**
Update `config.ts` with your WiFi credentials and server IP address. This is used to generate QR codes that players can scan to connect to the WiFi and join the game.

1. **Start the development server:**
   ```bash
   bun dev
   ```
   This starts both the server (port 3001) and frontend development server (port 5173).

1. **For production (compiled binary):**
   ```bash
   bun prod
   ```

1. **Connect devices:**
   - Display the main game on your TV at `http://{server.host}:{server.port}`
   - Players join by scanning QR code or navigating to the same URL on their phones

## 🎮 How to Play

### Game Host Setup
1. Open the admin panel on your main display
2. Navigate between game modes using the admin controls
3. Start rounds and manage game flow
4. Keep score across your 5-round game show event
