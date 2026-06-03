import type * as SQLite from 'expo-sqlite'

export const DATABASE_NAME = 'fitapp.db'
const SCHEMA_VERSION = 3

type ColumnDef = {
    name: string
    sqlType: string
    defaultValue?: string
}

const SYNC_METADATA_COLUMNS: ColumnDef[] = [
    { name: 'uuid', sqlType: 'TEXT' },
    { name: 'user_id', sqlType: 'TEXT' },
    { name: 'created_at', sqlType: 'TEXT', defaultValue: 'CURRENT_TIMESTAMP' },
    { name: 'updated_at', sqlType: 'TEXT', defaultValue: 'CURRENT_TIMESTAMP' },
    { name: 'deleted_at', sqlType: 'TEXT' },
    { name: 'sync_status', sqlType: 'TEXT', defaultValue: "'local'" },
    { name: 'last_synced_at', sqlType: 'TEXT' },
    // Consecutive failed push attempts. Drives the give-up / dead-letter
    // policy: a row that keeps failing is eventually marked 'blocked' and
    // dropped from the outbox so it stops re-failing every cycle.
    { name: 'sync_attempts', sqlType: 'INTEGER', defaultValue: '0' },
]

const getColumnDefinitions = async (db: SQLite.SQLiteDatabase, table: string) => {
    return db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)
}

const ensureColumn = async (db: SQLite.SQLiteDatabase, table: string, column: ColumnDef) => {
    const columns = await getColumnDefinitions(db, table)
    if (columns.some((existing) => existing.name === column.name)) {
        return
    }

    const defaultClause = column.defaultValue ? ` DEFAULT ${column.defaultValue}` : ''
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column.name} ${column.sqlType}${defaultClause};`)
}

const ensureSyncMetadataColumns = async (db: SQLite.SQLiteDatabase, table: 'exercises' | 'workouts' | 'sets') => {
    for (const column of SYNC_METADATA_COLUMNS) {
        await ensureColumn(db, table, column)
    }
}

const backfillSyncMetadata = async (db: SQLite.SQLiteDatabase) => {
    for (const table of ['exercises', 'workouts', 'sets'] as const) {
        await db.execAsync(`
      UPDATE ${table}
      SET uuid = lower(hex(randomblob(16)))
      WHERE uuid IS NULL OR uuid = '';
    `)
        await db.execAsync(`
      UPDATE ${table}
      SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP),
          sync_status = COALESCE(sync_status, 'local')
      WHERE created_at IS NULL OR updated_at IS NULL OR sync_status IS NULL;
    `)
    }
}

const createTables = async (db: SQLite.SQLiteDatabase) => {
    await db.execAsync(`
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      user_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'weight',
      muscle_group TEXT,
      photo_uri TEXT,
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      sync_status TEXT DEFAULT 'local',
      last_synced_at TEXT,
      sync_attempts INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      user_id TEXT,
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      status TEXT DEFAULT 'finished',
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      sync_status TEXT DEFAULT 'local',
      last_synced_at TEXT,
      sync_attempts INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      user_id TEXT,
      workout_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      weight REAL,
      reps INTEGER,
      distance REAL,
      duration REAL,
      rpe INTEGER,
      position INTEGER DEFAULT 0,
      sub_sets TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      sync_status TEXT DEFAULT 'local',
      last_synced_at TEXT,
      sync_attempts INTEGER DEFAULT 0,
      FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS deletion_tombstones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_uuid TEXT NOT NULL,
      user_id TEXT,
      deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sync_status TEXT NOT NULL DEFAULT 'dirty',
      sync_attempts INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      is_syncing INTEGER NOT NULL DEFAULT 0,
      outbox_size INTEGER NOT NULL DEFAULT 0,
      last_success_at TEXT,
      last_attempt_at TEXT,
      last_error TEXT
    );
  `)
}

const createIndexes = async (db: SQLite.SQLiteDatabase) => {
    await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_exercises_position_name ON exercises(position, name);
    CREATE INDEX IF NOT EXISTS idx_exercises_uuid ON exercises(uuid);

    CREATE INDEX IF NOT EXISTS idx_workouts_date_status ON workouts(date, status);
    CREATE INDEX IF NOT EXISTS idx_workouts_uuid ON workouts(uuid);

    CREATE INDEX IF NOT EXISTS idx_sets_workout_position ON sets(workout_id, position);
    CREATE INDEX IF NOT EXISTS idx_sets_exercise ON sets(exercise_id);
    CREATE INDEX IF NOT EXISTS idx_sets_uuid ON sets(uuid);

    CREATE INDEX IF NOT EXISTS idx_tombstones_status ON deletion_tombstones(sync_status, deleted_at);
    CREATE INDEX IF NOT EXISTS idx_tombstones_entity ON deletion_tombstones(entity_type, entity_uuid);
  `)
}

const dropDeadTables = async (db: SQLite.SQLiteDatabase) => {
    // sync_queue was conceptually replaced by the Outbox in the data-layer
    // refactor (PRD #1). The table was carried forward unused; drop it now.
    await db.execAsync(`DROP TABLE IF EXISTS sync_queue;`)
}

export async function initializeDb(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `)

    await createTables(db)
    await dropDeadTables(db)
    await ensureSyncMetadataColumns(db, 'exercises')
    await ensureSyncMetadataColumns(db, 'workouts')
    await ensureSyncMetadataColumns(db, 'sets')
    await ensureColumn(db, 'deletion_tombstones', {
        name: 'sync_attempts',
        sqlType: 'INTEGER',
        defaultValue: '0',
    })
    await backfillSyncMetadata(db)
    await createIndexes(db)
    await db.execAsync(`
    INSERT OR IGNORE INTO sync_state (id, is_syncing, outbox_size)
    VALUES (1, 0, 0);
  `)

    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`)
}
