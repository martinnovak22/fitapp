import * as SQLite from 'expo-sqlite';

export const DATABASE_NAME = 'fitapp.db';

export async function migrateDbIfNeeded(db: SQLite.SQLiteDatabase) {
  const DATABASE_VERSION = 1;

  // Track version
  // await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  // In a real app we would check the version and apply incremental migrations.
  // For this MVP, we will just create if not exists.

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'weight', -- 'weight', 'cardio', 'bodyweight'
        muscle_group TEXT, -- 'chest', 'back', 'legs', etc.
        photo_uri TEXT
    );

    CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL, -- ISO8601 string 'YYYY-MM-DD'
        start_time TEXT, -- ISO8601 string
        end_time TEXT,
        status TEXT DEFAULT 'finished', -- 'in_progress', 'finished'
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
        FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );
  `);
}
