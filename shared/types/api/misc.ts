import { type Static, t } from "elysia";
import { PlayerScreenType } from "../domain/misc";

export const PlayerScreenResponseType = t.Object({
  screen: PlayerScreenType,
});
export type PlayerScreenResponse = Static<typeof PlayerScreenResponseType>;

export const SetPlayerScreenRequestType = t.Object({
  screen: PlayerScreenType,
});
export type SetPlayerScreenRequest = Static<typeof SetPlayerScreenRequestType>;
