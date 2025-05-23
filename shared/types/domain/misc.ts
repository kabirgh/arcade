import { t } from "elysia";

export enum PlayerScreen {
  Join = "/join",
  Buzzer = "/buzzer",
  Joystick = "/joystick",
}
export const PlayerScreenType = t.Enum(PlayerScreen);

export enum HostScreen {
  Home = "/",
  BuzzerHost = "/buzzer-host",
  Codenames = "/codenames",
  Pong = "/pong",
}
export const HostScreenType = t.Enum(HostScreen);
