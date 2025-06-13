// Simple in-memory database
import { ElysiaWS } from "elysia/dist/ws";

import { PlayerScreen } from "../shared/types/domain/misc";
import { Color, type Player, type Team } from "../shared/types/domain/player";

// Default values on server start
class DB {
  // Let server read/write fields directly
  public teams: Team[] = [
    { id: "1", name: "Team 1", color: Color.Red, score: 0 },
    { id: "2", name: "Team 2", color: Color.Blue, score: 0 },
    { id: "3", name: "Team 3", color: Color.Green, score: 0 },
    { id: "4", name: "Team 4", color: Color.Yellow, score: 0 },
  ];
  public screen: PlayerScreen = PlayerScreen.Join;
  // ws id -> {ws, player}
  public wsPlayerMap: Map<string, { ws: ElysiaWS; player: Player }> = new Map();
  public hostWs: ElysiaWS | null = null;
  public kickedPlayerIds: Set<string> = new Set();

  public get players(): Player[] {
    return Array.from(this.wsPlayerMap.values()).map((entry) => entry.player);
  }
}

export default DB;
