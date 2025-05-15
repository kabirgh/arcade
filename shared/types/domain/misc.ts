import { t } from "elysia";

export enum PlayerScreen {
  Join = "/join",
  Buzzer = "/buzzer",
  Joystick = "/joystick",
}
export const PlayerScreenType = t.Enum(PlayerScreen);
