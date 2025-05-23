import { type Static, t } from "elysia";

import { PlayerType } from "../domain/player";
import { Channel } from "../domain/websocket";
import { MessageType } from "../domain/websocket";

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
    timestamp: t.Number(),
  }),
});
export type BuzzerPressMessage = Static<typeof BuzzerPressMessageType>;

const BuzzerResetMessageType = t.Object({
  channel: t.Literal(Channel.BUZZER),
  messageType: t.Literal(MessageType.RESET),
  // No payload, reset is sent from server to all clients
});
export type BuzzerResetMessage = Static<typeof BuzzerResetMessageType>;

export const JoystickMoveMessageType = t.Object({
  channel: t.Literal(Channel.JOYSTICK),
  messageType: t.Literal(MessageType.MOVE),
  payload: t.Object({
    playerId: t.String(),
    angle: t.Number(),
    force: t.Number(),
  }),
});
export type JoystickMoveMessage = Static<typeof JoystickMoveMessageType>;

export const ClaimHostMessageType = t.Object({
  channel: t.Literal(Channel.ADMIN),
  messageType: t.Literal(MessageType.CLAIM_HOST),
  // No payload, server looks at websocket id to set host
});
export type ClaimHostMessage = Static<typeof ClaimHostMessageType>;

const NavigateMessageType = t.Object({
  channel: t.Literal(Channel.ADMIN),
  messageType: t.Union([
    t.Literal(MessageType.HOST_NAVIGATE),
    t.Literal(MessageType.PLAYER_NAVIGATE),
  ]),
  payload: t.Object({
    url: t.String(),
  }),
});
export type NavigateMessage = Static<typeof NavigateMessageType>;

export const WebSocketMessageType = t.Union([
  PlayerListAllMessageType,
  PlayerJoinMessageType,
  PlayerLeaveMessageType,
  BuzzerPressMessageType,
  BuzzerResetMessageType,
  JoystickMoveMessageType,
  ClaimHostMessageType,
  NavigateMessageType,
]);
export type WebSocketMessage = Static<typeof WebSocketMessageType>;

export const SendWebSocketMessageRequestType = t.Object({
  id: t.String(),
  message: WebSocketMessageType,
});
export type SendWebSocketMessageRequest = Static<
  typeof SendWebSocketMessageRequestType
>;

export const SendWebSocketMessageResponseType = t.Object({});
export type SendWebSocketMessageResponse = Static<
  typeof SendWebSocketMessageResponseType
>;

export const ListWebSocketClientIdsRequestType = t.Object({});
export type ListWebSocketClientIdsRequest = Static<
  typeof ListWebSocketClientIdsRequestType
>;

export const ListWebSocketClientIdsResponseType = t.Object({
  ids: t.Array(t.String()),
});
export type ListWebSocketClientIdsResponse = Static<
  typeof ListWebSocketClientIdsResponseType
>;
