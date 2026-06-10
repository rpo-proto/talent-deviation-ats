import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_DB_PATH = path.join(process.cwd(), ".local", "talent.db");

type GlobalWithDb = typeof globalThis & {
  __talentDeviationDb?: Database.Database;
};

function resolveDbPath() {
  const configured = process.env.TALENT_ATS_DB_PATH ?? DEFAULT_DB_PATH;
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

function openDb() {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function getDb() {
  const globalForDb = globalThis as GlobalWithDb;
  if (!globalForDb.__talentDeviationDb) {
    globalForDb.__talentDeviationDb = openDb();
    migrate(globalForDb.__talentDeviationDb);
  }
  return globalForDb.__talentDeviationDb;
}

export function migrate(db = getDb()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT 'Product',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      external_id TEXT,
      role_id TEXT NOT NULL REFERENCES roles(id),
      name TEXT NOT NULL,
      email TEXT,
      linkedin_url TEXT,
      source TEXT,
      stage TEXT NOT NULL,
      stage_order INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      drive_url TEXT,
      profile_url TEXT,
      resume_url TEXT,
      retained INTEGER NOT NULL DEFAULT 0,
      last_activity_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_external_role
      ON candidates(external_id, role_id)
      WHERE external_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_candidates_role_stage
      ON candidates(role_id, stage_order);

    CREATE TABLE IF NOT EXISTS evidence_events (
      id TEXT PRIMARY KEY,
      candidate_id TEXT REFERENCES candidates(id),
      role_id TEXT REFERENCES roles(id),
      occurred_at TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_label TEXT,
      source_url TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      author TEXT,
      evidence_weight REAL NOT NULL DEFAULT 0.5,
      visibility TEXT NOT NULL DEFAULT 'private',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_events_candidate_time
      ON evidence_events(candidate_id, occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_events_time
      ON evidence_events(occurred_at DESC);

    CREATE TABLE IF NOT EXISTS scorecards (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL REFERENCES candidates(id),
      reviewer TEXT NOT NULL,
      reviewer_type TEXT NOT NULL,
      rubric TEXT NOT NULL,
      scores_json TEXT NOT NULL DEFAULT '{}',
      summary TEXT NOT NULL,
      recommendation TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS nudges (
      id TEXT PRIMARY KEY,
      candidate_id TEXT REFERENCES candidates(id),
      owner TEXT NOT NULL,
      reason TEXT NOT NULL,
      due_at TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      label TEXT,
      source_type TEXT,
      imported_by TEXT,
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  addColumnIfMissing(db, "candidates", "profile_url", "TEXT");
  addColumnIfMissing(db, "candidates", "resume_url", "TEXT");
}

export function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function addColumnIfMissing(db: Database.Database, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
