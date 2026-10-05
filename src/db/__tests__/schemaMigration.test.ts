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
        `INSERT INTO exercises (uuid, user_id, name, muscle_group, sync_status, updated_at)
         VALUES ('ex-1', 'user-A', 'Bench', 'hrudník', 'synced', '2026-09-01T09:00:00Z')`
    )
    await db.runAsync(
        `INSERT INTO workouts (uuid, user_id, date, status, sync_status, updated_at)
         VALUES ('w-1', 'user-A', '2026-09-01', 'finished', 'synced', '2026-09-01T10:00:00Z')`
    )
    await db.runAsync(
        `INSERT INTO pull_cursors
           (user_id, workouts_updated, exercises_updated, sets_updated, exercises_deleted, workouts_deleted, sets_deleted)
         VALUES ('user-A', '2026-09-01T10:00:00Z', '2026-09-02T00:00:00Z', '2026-09-03T00:00:00Z',
                 '2026-09-04T00:00:00Z', '2026-09-05T00:00:00Z', '2026-09-06T00:00:00Z')`
    )
    return db
}

const columnsOf = async (db: ReturnType<typeof createInMemorySqliteDb>, table: string) =>
    (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name)

describe('initializeDb upgrade from schema v4 to the current schema', () => {
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
        // The exercise taxonomy columns arrive empty: Muscles are derived from the
        // untouched legacy text at read time, so no row is rewritten or re-queued.
        const exercise = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM exercises WHERE uuid = 'ex-1'`)
        expect(exercise).toMatchObject({
            name: 'Bench',
            muscle_group: 'hrudník',
            primary_muscle: null,
            secondary_muscles: null,
            equipment: null,
            sync_status: 'synced',
            updated_at: '2026-09-01T09:00:00Z',
        })
        // Rows pulled before the upgrade get their new columns backfilled on the
        // next pull, and Sets lost to the old Exercise hard delete are re-pulled;
        // unrelated cursors stay.
        const cursor = await db.getFirstAsync<Record<string, string | null>>(
            `SELECT workouts_updated, exercises_updated, sets_updated, exercises_deleted, workouts_deleted, sets_deleted
             FROM pull_cursors WHERE user_id = 'user-A'`
        )
        // Workouts for template_uuid (v5), Exercises for the taxonomy columns
        // (v6), Sets and Exercise deletions for the soft delete (v7).
        expect(cursor).toEqual({
            workouts_updated: null,
            exercises_updated: null,
            sets_updated: null,
            exercises_deleted: null,
            workouts_deleted: '2026-09-05T00:00:00Z',
            sets_deleted: '2026-09-06T00:00:00Z',
        })

        const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
        expect(version?.user_version).toBe(7)
    })

    it('is idempotent across repeated launches and resets the cursor only on the upgrade', async () => {
        const db = await createV4Db()

        await initializeDb(db as unknown as SQLite.SQLiteDatabase)
        await db.runAsync(
            `UPDATE pull_cursors SET workouts_updated = '2026-10-01T00:00:00Z', exercises_updated = '2026-10-01T00:00:00Z',
                    sets_updated = '2026-10-01T00:00:00Z', exercises_deleted = '2026-10-01T00:00:00Z'`
        )
        await initializeDb(db as unknown as SQLite.SQLiteDatabase)

        const count = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) c FROM workouts')
        expect(count?.c).toBe(1)
        const cursor = await db.getFirstAsync<Record<string, string>>(
            'SELECT workouts_updated, exercises_updated, sets_updated, exercises_deleted FROM pull_cursors'
        )
        expect(cursor).toEqual({
            workouts_updated: '2026-10-01T00:00:00Z',
            exercises_updated: '2026-10-01T00:00:00Z',
            sets_updated: '2026-10-01T00:00:00Z',
            exercises_deleted: '2026-10-01T00:00:00Z',
        })
    })
})

describe('initializeDb upgrade from schema v6 (issue #85)', () => {
    // A current-shape database as a v6 app left it, with every cursor advanced.
    const createV6Db = async () => {
        const db = await createV4Db()
        await initializeDb(db as unknown as SQLite.SQLiteDatabase)
        await db.runAsync(
            `UPDATE pull_cursors SET workouts_updated = '2026-10-01T00:00:00Z', exercises_updated = '2026-10-02T00:00:00Z',
                    sets_updated = '2026-10-03T00:00:00Z', exercises_deleted = '2026-10-04T00:00:00Z'`
        )
        await db.execAsync('PRAGMA user_version = 6;')
        return db
    }

    const cursorOf = (db: ReturnType<typeof createInMemorySqliteDb>) =>
        db.getFirstAsync<Record<string, string | null>>(
            `SELECT workouts_updated, exercises_updated, sets_updated, exercises_deleted, workouts_deleted, sets_deleted
             FROM pull_cursors WHERE user_id = 'user-A'`
        )

    it('re-pulls Sets and Exercise deletions once, so Sets lost to the old hard delete come back', async () => {
        const db = await createV6Db()

        await initializeDb(db as unknown as SQLite.SQLiteDatabase)

        expect(await cursorOf(db)).toEqual({
            workouts_updated: '2026-10-01T00:00:00Z',
            exercises_updated: '2026-10-02T00:00:00Z',
            sets_updated: null,
            exercises_deleted: null,
            workouts_deleted: '2026-09-05T00:00:00Z',
            sets_deleted: '2026-09-06T00:00:00Z',
        })
        const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
        expect(version?.user_version).toBe(7)
    })

    it('resets them only on that upgrade, not on later launches', async () => {
        const db = await createV6Db()
        await initializeDb(db as unknown as SQLite.SQLiteDatabase)
        await db.runAsync(
            `UPDATE pull_cursors SET sets_updated = '2026-10-05T00:00:00Z', exercises_deleted = '2026-10-05T00:00:00Z'`
        )

        await initializeDb(db as unknown as SQLite.SQLiteDatabase)

        expect(await cursorOf(db)).toMatchObject({
            sets_updated: '2026-10-05T00:00:00Z',
            exercises_deleted: '2026-10-05T00:00:00Z',
        })
    })
})
