// WebSocket message types for the game
import { type Static, t } from "elysia";
import { PlayerType } from "./player";

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

const PlayerListAllMessageType = t.Object({
  channel: t.Literal(Channel.PLAYER),
  messageType: t.Literal(MessageType.LIST),
  payload: t.Array(PlayerType),
});

export type PlayerListAllMessage = Static<typeof PlayerListAllMessageType>;

const PlayerJoinMessageType = t.Object({
  channel: t.Literal(Channel.PLAYER),
  messageType: t.Literal(MessageType.JOIN),
  payload: PlayerType,
});
export type PlayerJoinMessage = Static<typeof PlayerJoinMessageType>;

const PlayerLeaveMessageType = t.Object({
  channel: t.Literal(Channel.PLAYER),
  messageType: t.Literal(MessageType.LEAVE),
  // No payload as relevant player is derived from websocket connection map
  // TODO: provide player name in payload
});
export type PlayerLeaveMessage = Static<typeof PlayerLeaveMessageType>;

const BuzzerPressMessageType = t.Object({
  channel: t.Literal(Channel.BUZZER),
  messageType: t.Literal(MessageType.BUZZ),
  payload: t.Object({
    player: PlayerType,
  }),
});
export type BuzzerPressMessage = Static<typeof BuzzerPressMessageType>;

const BuzzerResetMessageType = t.Object({
  channel: t.Literal(Channel.BUZZER),
  messageType: t.Literal(MessageType.RESET),
  // No payload, reset is sent from server to all clients
});
export type BuzzerResetMessage = Static<typeof BuzzerResetMessageType>;

export const WebSocketMessageType = t.Union([
  PlayerListAllMessageType,
  PlayerJoinMessageType,
  PlayerLeaveMessageType,
  BuzzerPressMessageType,
  BuzzerResetMessageType,
]);
export type WebSocketMessage = Static<typeof WebSocketMessageType>;

export const SendWebSocketMessageRequestType = t.Object({
  id: t.String(),
  message: WebSocketMessageType,
});
export type SendWebSocketMessageRequest = Static<
  typeof SendWebSocketMessageRequestType
>;
