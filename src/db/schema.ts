import * as SQLite from 'expo-sqlite';

export const DATABASE_NAME = 'fitapp.db';
/**
 * Initializes the database by creating tables if they don't exist.
 * This ensures the app maintains data across restarts without complex migrations.
 * @param db The SQLite database instance.
 */
export async function initializeDb(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'weight',
        muscle_group TEXT,
        photo_uri TEXT,
        position INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        status TEXT DEFAULT 'finished',
        note TEXT
    );

    CREATE TABLE IF NOT EXISTS sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
        FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );
  `);
}


