// WebSocket message types for the game

export enum Channel {
  PLAYER,
  BUZZER,
}

export interface WebSocketMessage {
  channel: Channel;
  payload?: any;
}

export type WebSocketConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";
