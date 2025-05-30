import { t } from "elysia";

export enum PlayerScreen {
  Join = "/join",
  Buzzer = "/buzzer",
  Joystick = "/joystick",
}
export const PlayerScreenType = t.Enum(PlayerScreen);

export enum HostScreen {
  Lobby = "/",
  BuzzerHost = "/buzzer-host",
  Codenames = "/codenames",
  Pong = "/pong",
  Boat = "/boat",
  Ninja = "/ninja",
}
export const HostScreenType = t.Enum(HostScreen);
