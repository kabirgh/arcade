// WebSocket message types for the game
import { type Static, t } from "elysia";
import { PlayerType } from "./player";

export type WebSocketConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

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

const AllPlayersMessageType = t.Object({
  channel: t.Literal(Channel.PLAYER),
  messageType: t.Literal(MessageType.ALL_PLAYERS),
  payload: t.Array(PlayerType),
});

export type AllPlayersMessage = Static<typeof AllPlayersMessageType>;

const JoinMessageType = t.Object({
  channel: t.Literal(Channel.PLAYER),
  messageType: t.Literal(MessageType.JOIN),
  payload: PlayerType,
});
export type JoinMessage = Static<typeof JoinMessageType>;

const LeaveMessageType = t.Object({
  channel: t.Literal(Channel.PLAYER),
  messageType: t.Literal(MessageType.LEAVE),
  // No payload as relevant player is derived from websocket connection map
});
export type LeaveMessage = Static<typeof LeaveMessageType>;

const BuzzMessageType = t.Object({
  channel: t.Literal(Channel.BUZZER),
  messageType: t.Literal(MessageType.BUZZ),
  payload: t.Object({
    playerName: t.String(),
  }),
});
export type BuzzMessage = Static<typeof BuzzMessageType>;

export const WebSocketMessageType = t.Union([
  AllPlayersMessageType,
  JoinMessageType,
  LeaveMessageType,
  BuzzMessageType,
]);
export type WebSocketMessage = Static<typeof WebSocketMessageType>;
