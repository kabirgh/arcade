export enum Channel {
  PLAYER = "PLAYER",
  BUZZER = "BUZZER",
  JOYSTICK = "JOYSTICK",
  ADMIN = "ADMIN",
}

export enum MessageType {
  // Player channel
  JOIN = "JOIN",
  LEAVE = "LEAVE",
  LIST = "LIST",
  // Buzzer channel
  BUZZ = "BUZZ",
  RESET = "RESET",
  // Joystick channel
  MOVE = "MOVE",
  // Admin channel
  CLAIM_HOST = "CLAIM_HOST",
}
