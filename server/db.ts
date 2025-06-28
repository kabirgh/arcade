// SQLite persistent database
import { Database } from "bun:sqlite";
import { ElysiaWS } from "elysia/dist/ws";

import { PlayerScreen } from "../shared/types/domain/misc";
import { Color, type Player, type Team } from "../shared/types/domain/player";
import { generateId } from "../shared/utils";

class DB {
  private db: Database;
  // ws id -> {ws, player}
  public wsPlayerMap: Map<string, { ws: ElysiaWS; player: Player | null }> =
    new Map();
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

    // Create session table for storing session data
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL
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
      insertTeam.run(generateId("team", 6), "Team 1", Color.Red, 0);
      insertTeam.run(generateId("team", 6), "Team 2", Color.Blue, 0);
      insertTeam.run(generateId("team", 6), "Team 3", Color.Green, 0);
      insertTeam.run(generateId("team", 6), "Team 4", Color.Yellow, 0);
    }

    // Set screen setting to Buzzer on startup
    this.db
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
      .run("screen", PlayerScreen.Buzzer);

    // Set session data if it doesn't exist
    const existingSession = this.getSession();
    if (!existingSession) {
      this.startNewSession();
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
    const row = this.db
      .query("SELECT value FROM settings WHERE key = 'screen'")
      .get() as { value: string } | null;
    return row?.value as PlayerScreen;
  }

  public set screen(newScreen: PlayerScreen) {
    this.db
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
      .run("screen", newScreen);
  }

  public get players(): Player[] {
    return Array.from(this.wsPlayerMap.values())
      .filter((entry) => entry.player !== null)
      .map((entry) => entry.player!);
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

  // Session methods
  public getSession(): { sessionId: string; createdAt: number } | null {
    const row = this.db
      .query("SELECT id, created_at FROM session LIMIT 1")
      .get() as { id: string; created_at: number } | null;

    if (!row) return null;

    return {
      sessionId: row.id,
      createdAt: row.created_at,
    };
  }

  public startNewSession(): { sessionId: string; createdAt: number } {
    // Session ID is used by the client to determine whether they should delete the cached player data.
    const sessionId = generateId("session", 4);
    const createdAt = Date.now();

    // Clear any existing session and insert the new one
    this.endSession();
    this.db
      .prepare("INSERT INTO session (id, created_at) VALUES (?, ?)")
      .run(sessionId, createdAt);

    console.log(
      "Session ID:",
      sessionId,
      "Created at:",
      new Date(createdAt).toISOString()
    );

    // Reset team scores
    for (const team of this.teams) {
      this.updateTeamScore(team.id, 0);
    }

    return { sessionId, createdAt };
  }

  public endSession(): void {
    this.db.exec("DELETE FROM session");
    this.wsPlayerMap.clear();
    this.kickedPlayerIds.clear();
    this.screen = PlayerScreen.Buzzer;
  }
}

export default DB;
