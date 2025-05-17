// Simple in-memory database
import { ElysiaWS } from "elysia/dist/ws";
import { PlayerScreen } from "../shared/types/domain/misc";
import { Color, type Player, type Team } from "../shared/types/domain/player";

// Default values on server start
class DB {
  // Let server read/write fields directly
  public teams: Team[] = [
    { id: "1", name: "Team 1", color: Color.Red },
    { id: "2", name: "Team 2", color: Color.Blue },
    { id: "3", name: "Team 3", color: Color.Green },
    { id: "4", name: "Team 4", color: Color.Yellow },
  ];
  public screen: PlayerScreen = PlayerScreen.Join;
  public wsPlayerMap: Map<ElysiaWS, Player | null> = new Map();

  public get players(): Player[] {
    return Array.from(this.wsPlayerMap.values()).filter(
      (player) => player !== null
    );
  }
}

export default DB;
