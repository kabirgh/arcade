export enum Channel {
  PLAYER = "PLAYER",
  BUZZER = "BUZZER",
}

export enum MessageType {
  // Player channel
  JOIN = "JOIN",
  LEAVE = "LEAVE",
  LIST = "LIST",
  // Buzzer channel
  BUZZ = "BUZZ",
  RESET = "RESET",
}
