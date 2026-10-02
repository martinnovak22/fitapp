// Upgrading an existing install must never lose data. Builds a database in the
// pre-template (schema v4) shape, fills it, then runs the current initializeDb
// over it the way an app update would.

import type * as SQLite from 'expo-sqlite'
import { describe, expect, it } from 'vitest'
import { createInMemorySqliteDb } from '@/src/test/inMemorySqlite'
import { initializeDb } from '../schema'

const V4_TABLES = `
    CREATE TABLE exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE, user_id TEXT, name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'weight', muscle_group TEXT, photo_uri TEXT, photo_key TEXT,
      position INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT, deleted_at TEXT,
      sync_status TEXT DEFAULT 'local', last_synced_at TEXT, sync_attempts INTEGER DEFAULT 0
    );
    CREATE TABLE workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE, user_id TEXT, date TEXT NOT NULL,
      start_time TEXT, end_time TEXT, status TEXT DEFAULT 'finished', note TEXT,
      created_at TEXT, updated_at TEXT, deleted_at TEXT,
      sync_status TEXT DEFAULT 'local', last_synced_at TEXT, sync_attempts INTEGER DEFAULT 0
    );
    CREATE TABLE pull_cursors (
      user_id TEXT PRIMARY KEY, exercises_updated TEXT, exercises_deleted TEXT,
      workouts_updated TEXT, workouts_deleted TEXT, sets_updated TEXT, sets_deleted TEXT
    );
    PRAGMA user_version = 4;
`

const createV4Db = async () => {
    const db = createInMemorySqliteDb()
    await db.execAsync(V4_TABLES)
    await db.runAsync(
        `INSERT INTO exercises (uuid, user_id, name, sync_status) VALUES ('ex-1', 'user-A', 'Bench', 'synced')`
    )
    await db.runAsync(
        `INSERT INTO workouts (uuid, user_id, date, status, sync_status, updated_at)
         VALUES ('w-1', 'user-A', '2026-09-01', 'finished', 'synced', '2026-09-01T10:00:00Z')`
    )
    await db.runAsync(`INSERT INTO pull_cursors (user_id, workouts_updated) VALUES ('user-A', '2026-09-01T10:00:00Z')`)
    return db
}

const columnsOf = async (db: ReturnType<typeof createInMemorySqliteDb>, table: string) =>
    (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name)

describe('initializeDb upgrade from schema v4', () => {
    it('adds the Workout Template schema and keeps every existing row untouched', async () => {
        const db = await createV4Db()

        await initializeDb(db as unknown as SQLite.SQLiteDatabase)

        expect(await columnsOf(db, 'workouts')).toContain('template_uuid')
        expect(await columnsOf(db, 'pull_cursors')).toEqual(
            expect.arrayContaining(['templates_updated', 'templates_deleted'])
        )
        expect(await columnsOf(db, 'workout_templates')).toEqual(
            expect.arrayContaining(['uuid', 'user_id', 'name', 'exercise_uuids', 'sync_status', 'sync_attempts'])
        )

        // Existing Workouts become Unplanned and are not re-queued for push.
        const workout = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM workouts WHERE uuid = 'w-1'`)
        expect(workout).toMatchObject({
            date: '2026-09-01',
            status: 'finished',
            sync_status: 'synced',
            updated_at: '2026-09-01T10:00:00Z',
            template_uuid: null,
        })
        const exercise = await db.getFirstAsync<{ name: string }>(`SELECT name FROM exercises WHERE uuid = 'ex-1'`)
        expect(exercise?.name).toBe('Bench')
        // The incremental pull watermark survives, so the update causes no full re-pull.
        const cursor = await db.getFirstAsync<{ workouts_updated: string }>(
            `SELECT workouts_updated FROM pull_cursors WHERE user_id = 'user-A'`
        )
        expect(cursor?.workouts_updated).toBe('2026-09-01T10:00:00Z')

        const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
        expect(version?.user_version).toBe(5)
    })

    it('is idempotent across repeated launches', async () => {
        const db = await createV4Db()

        await initializeDb(db as unknown as SQLite.SQLiteDatabase)
        await initializeDb(db as unknown as SQLite.SQLiteDatabase)

        const count = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) c FROM workouts')
        expect(count?.c).toBe(1)
    })
})
