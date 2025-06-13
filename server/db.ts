// SQLite persistent database
import { Database } from "bun:sqlite";
import { ElysiaWS } from "elysia/dist/ws";

import { PlayerScreen } from "../shared/types/domain/misc";
import { Color, type Player, type Team } from "../shared/types/domain/player";

class DB {
  private db: Database;
  private _screen: PlayerScreen = PlayerScreen.Buzzer;
  // ws id -> {ws, player}
  public wsPlayerMap: Map<string, { ws: ElysiaWS; player: Player }> = new Map();
  public hostWs: ElysiaWS | null = null;
  public kickedPlayerIds: Set<string> = new Set();

  constructor() {
    const dbFileName =
      process.env.NODE_ENV === "production" ? "arcade.db" : "arcade.dev.db";
    this.db = new Database(dbFileName);
    this.initializeTables();
    this.seedDefaultData();
  }

  private initializeTables() {
    // Create teams table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        score INTEGER DEFAULT 0
      )
    `);

    // Create settings table for storing screen state and other config
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // No players table. Players are stored in memory in wsPlayerMap
    // If the server restarts, the clients will resend JOIN messages on reconnect
  }

  private seedDefaultData() {
    // Check if teams already exist
    const existingTeams = this.db
      .query("SELECT COUNT(*) as count FROM teams")
      .get() as { count: number };

    if (existingTeams.count === 0) {
      // Insert default teams
      const insertTeam = this.db.prepare(
        "INSERT INTO teams (id, name, color, score) VALUES (?, ?, ?, ?)"
      );
      insertTeam.run("1", "Team 1", Color.Red, 0);
      insertTeam.run("2", "Team 2", Color.Blue, 0);
      insertTeam.run("3", "Team 3", Color.Green, 0);
      insertTeam.run("4", "Team 4", Color.Yellow, 0);
    }

    // Initialize screen setting if it doesn't exist
    const screenSetting = this.db
      .query("SELECT value FROM settings WHERE key = 'screen'")
      .get() as { value: string } | null;
    if (!screenSetting) {
      this.db
        .prepare("INSERT INTO settings (key, value) VALUES (?, ?)")
        .run("screen", PlayerScreen.Buzzer);
    } else {
      this._screen = screenSetting.value as PlayerScreen;
    }
  }

  public get teams(): Team[] {
    const rows = this.db
      .query("SELECT id, name, color, score FROM teams")
      .all() as Array<{
      id: string;
      name: string;
      color: string;
      score: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color as Color,
      score: row.score,
    }));
  }

  public set teams(newTeams: Team[]) {
    // Clear existing teams
    this.db.exec("DELETE FROM teams");

    // Insert new teams
    const insertTeam = this.db.prepare(
      "INSERT INTO teams (id, name, color, score) VALUES (?, ?, ?, ?)"
    );

    for (const team of newTeams) {
      insertTeam.run(team.id, team.name, team.color, team.score);
    }
  }

  public get screen(): PlayerScreen {
    return this._screen;
  }

  public set screen(newScreen: PlayerScreen) {
    this._screen = newScreen;
    this.db
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
      .run("screen", newScreen);
  }

  public get players(): Player[] {
    return Array.from(this.wsPlayerMap.values()).map((entry) => entry.player);
  }

  // Helper methods for team operations
  public updateTeamScore(teamId: string, score: number): void {
    this.db
      .prepare("UPDATE teams SET score = ? WHERE id = ?")
      .run(score, teamId);
  }

  public updateTeamName(teamId: string, name: string): void {
    this.db.prepare("UPDATE teams SET name = ? WHERE id = ?").run(name, teamId);
  }

  public deleteTeam(teamId: string): void {
    this.db.prepare("DELETE FROM teams WHERE id = ?").run(teamId);
  }

  public addTeam(team: Team): void {
    this.db
      .prepare("INSERT INTO teams (id, name, color, score) VALUES (?, ?, ?, ?)")
      .run(team.id, team.name, team.color, team.score);
  }

  public getTeamById(teamId: string): Team | null {
    const row = this.db
      .query("SELECT id, name, color, score FROM teams WHERE id = ?")
      .get(teamId) as {
      id: string;
      name: string;
      color: string;
      score: number;
    } | null;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      color: row.color as Color,
      score: row.score,
    };
  }
}

export default DB;
