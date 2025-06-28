# Arcade

Arcade is an application to help you run a game night at home. Players join using their phone.

<img src="./docs/lobby.png" alt="Lobby screen">

Players get either a big red button to buzz in to answer quiz questions (questions not provided) or a joystick for the arcade games (games are provided).

<table>
  <tr>
    <td width="50%" style="text-align: center;"><img src="./docs/buzzer-portrait.png" alt="Buzzer screen" width="50%"></td>
    <td width="50%" style="text-align: center;"><img src="./docs/joystick-portrait.png" alt="Joystick screen" width="50%"></td>
  </tr>
</table>

## Table of contents
- [Arcade](#arcade)
  - [Table of contents](#table-of-contents)
  - [Features](#features)
    - [Buzzer rounds](#buzzer-rounds)
    - [Multiplayer arcade games](#multiplayer-arcade-games)
  - [Installation \& setup](#installation--setup)
    - [Prerequisites](#prerequisites)
    - [Instructions](#instructions)
  - [Admin controls](#admin-controls)

## Features

### Buzzer rounds
See who can buzz in first to answer questions.

<img src="./docs/buzzer-host.png" alt="Buzzer host">

### Multiplayer arcade games

**Pong**

Classic pong, but each player controls a mini-paddle.

<img src="./docs/pong.png" alt="Pong">

**Boat game**

Collect the most ducks before time runs out.

<img src="./docs/boat.png" alt="Boat game">

**Ninja run**

Avoid obstacles as the course speeds up.

<img src="./docs/ninja.png" alt="Ninja run">


## Installation & setup

### Prerequisites
- The [Bun](https://bun.sh) javascript runtime
- A computer to run the server
- A WiFi network connection, ideally one that lets you set up a static IP address for the server computer
- A display device (TV/projector) for the main game screen
- Mobile phones for players

> [!NOTE]
> This project does not have internet-grade security. I recommend only exposing the server to your local WiFi network.

### Instructions
1. **Clone and install dependencies**

   ```bash
   git clone https://github.com/kabirgh/arcade.git
   cd arcade
   bun install
   ```

1. **Set up configuration**

   Update `config.ts` with your WiFi credentials and server IP address. This is used to generate QR codes that players can scan to connect to the WiFi and join the game.

1. **Start the server**

   Use `bun prod` to compile and start the application.

   If you're editing the code, you can start the server with `bun dev`. This starts the application with hot reloading.

1. **Connect devices**
  Display the main game on your TV at `http://{server.host}:{server.port}`. Players can join by scanning the QR code on the screen.

1. **Navigate between screens using the admin controls**

   Open the admin panel on your main display at `http://{server.host}:{server.port}/admin` to use the admin controls.

## Admin controls

<img src="./docs/admin.png" alt="Admin screen">

The admin screen allows you to manage game flow. You can:
- Navigate between screens on the main display
- Reset buzzer presses
- Track team scores
- Start a new session, which kicks all players and resets scores
- Make any API call to the server. The most useful are:
  - `POST /api/players/kick` - Kick a player from the game
  - `POST /api/websocket/send-message` + `GAME/DUCK_SPAWN_INTERVAL` - Set how quickly ducks appear on screen in boat game
  - `POST /api/websocket/send-message` + `GAME/BOAT_ADD_TIME` - Add more time to the boat game timer
