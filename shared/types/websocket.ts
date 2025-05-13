import { type Player } from "./player";

// WebSocket message types for the game

export enum Channel {
  PLAYER = "PLAYER",
  BUZZER = "BUZZER",
}

export enum MessageType {
  // Player channel
  JOIN = "JOIN",
  LEAVE = "LEAVE",
  ALL_PLAYERS = "ALL_PLAYERS",
  // Buzzer channel
  BUZZ = "BUZZ",
}

interface AllPlayersMessage {
  channel: Channel.PLAYER;
  messageType: MessageType.ALL_PLAYERS;
  payload: Player[];
}

interface JoinMessage {
  channel: Channel.PLAYER;
  messageType: MessageType.JOIN;
  payload: Player;
}

interface LeaveMessage {
  channel: Channel.PLAYER;
  messageType: MessageType.LEAVE;
  // Player data derived from websocket connection map
}

interface BuzzMessage {
  channel: Channel.BUZZER;
  messageType: MessageType.BUZZ;
  payload: { playerName: string };
}

export type WebSocketMessage =
  | AllPlayersMessage
  | JoinMessage
  | LeaveMessage
  | BuzzMessage;

export type WebSocketConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";
