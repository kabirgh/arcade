export enum Channel {
  PLAYER = "PLAYER",
  BUZZER = "BUZZER",
  JOYSTICK = "JOYSTICK",
  ADMIN = "ADMIN",
  GAME = "GAME",
}

export enum MessageType {
  // Player channel
  JOIN = "JOIN",
  LEAVE = "LEAVE",
  KICK = "KICK",
  LIST = "LIST",
  JOIN_ERROR = "JOIN_ERROR",
  // Buzzer channel
  BUZZ = "BUZZ",
  RESET = "RESET",
  // Joystick channel
  MOVE = "MOVE",
  // Admin channel
  CLAIM_HOST = "CLAIM_HOST",
  HOST_NAVIGATE = "HOST_NAVIGATE",
  PLAYER_NAVIGATE = "PLAYER_NAVIGATE",
  // Game
  DUCK_SPAWN_INTERVAL = "DUCK_SPAWN_INTERVAL",
  BOAT_ADD_TIME = "BOAT_ADD_TIME",
}
