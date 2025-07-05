import { type Static, t } from "elysia";

import { HostScreenType, PlayerScreenType } from "../domain/misc";
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
  payload: t.Object({
    // Name is used only for logging
    playerName: t.String(),
  }),
});
export type PlayerLeaveMessage = Static<typeof PlayerLeaveMessageType>;

const PlayerKickMessageType = t.Object({
  channel: t.Literal(Channel.PLAYER),
  messageType: t.Literal(MessageType.KICK),
  payload: t.Object({
    playerId: t.String(),
  }),
});
export type PlayerKickMessage = Static<typeof PlayerKickMessageType>;

const BuzzerPressMessageType = t.Object({
  channel: t.Literal(Channel.BUZZER),
  messageType: t.Literal(MessageType.BUZZ),
  payload: t.Object({
    playerId: t.String(),
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

const NavigatePlayerMessageType = t.Object({
  channel: t.Literal(Channel.ADMIN),
  messageType: t.Literal(MessageType.PLAYER_NAVIGATE),
  payload: t.Object({
    screen: PlayerScreenType,
  }),
});
export type NavigatePlayerMessage = Static<typeof NavigatePlayerMessageType>;

const NavigateHostMessageType = t.Object({
  channel: t.Literal(Channel.ADMIN),
  messageType: t.Literal(MessageType.HOST_NAVIGATE),
  payload: t.Object({
    screen: HostScreenType,
  }),
});
export type NavigateHostMessage = Static<typeof NavigateHostMessageType>;

const StartGameMessageType = t.Object({
  channel: t.Literal(Channel.GAME),
  messageType: t.Literal(MessageType.START_GAME),
});
export type StartGameMessage = Static<typeof StartGameMessageType>;

const SetDuckSpawnIntervalMessageType = t.Object({
  channel: t.Literal(Channel.GAME),
  messageType: t.Literal(MessageType.DUCK_SPAWN_INTERVAL),
  payload: t.Object({
    intervalMs: t.Number(),
  }),
});
export type SetDuckSpawnIntervalMessage = Static<
  typeof SetDuckSpawnIntervalMessageType
>;

const BoatAddTimeMessageType = t.Object({
  channel: t.Literal(Channel.GAME),
  messageType: t.Literal(MessageType.BOAT_ADD_TIME),
  payload: t.Object({
    timeSeconds: t.Number(),
  }),
});
export type BoatAddTimeMessage = Static<typeof BoatAddTimeMessageType>;

export const WebSocketMessageType = t.Union([
  PlayerListAllMessageType,
  PlayerJoinMessageType,
  PlayerLeaveMessageType,
  PlayerKickMessageType,
  BuzzerPressMessageType,
  BuzzerResetMessageType,
  JoystickMoveMessageType,
  ClaimHostMessageType,
  NavigatePlayerMessageType,
  NavigateHostMessageType,
  StartGameMessageType,
  SetDuckSpawnIntervalMessageType,
  BoatAddTimeMessageType,
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
