import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabaseAdapter, type FakeSupabaseAdapter } from '@/src/test/fakeSupabase'
import { createTestDb, getTestDb, resetTestDb, type TestDb, useTestDb } from '@/src/test/setupTestDb'

vi.mock('@/src/db/client', () => ({
    getDb: async () => getTestDb(),
}))

const { executeWriteTransaction } = await import('@/src/db/writeQueue')
const { createOutbox } = await import('../Outbox')
const { capturePrincipalSnapshot } = await import('../PrincipalSnapshot')
const { drainOutbox } = await import('../SyncCycle')
const { createRemoteWriter } = await import('../RemoteWriter')
const { createRemoteIdResolver } = await import('../RemoteIdResolver')
const { makePushFn, preloadSetParents } = await import('../PushPipeline')

let db: TestDb
let adapter: FakeSupabaseAdapter
const userId = 'user-1'
const snapshot = () => capturePrincipalSnapshot({ userId })
const noopPhotos = { upload: async () => null, cleanup: async () => {} }

beforeEach(async () => {
    await resetTestDb()
    db = await createTestDb()
    useTestDb(db)
    adapter = createFakeSupabaseAdapter()
})

const insertDirtyExercise = async (uuid: string) => {
    await db.runAsync(
        `INSERT INTO exercises (uuid, user_id, name, type, sync_status, created_at, updated_at)
        VALUES (?, ?, ?, 'weight', 'dirty', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
        uuid,
        userId,
        uuid
    )
}
const insertDirtyWorkout = async (uuid: string) => {
    await db.runAsync(
        `INSERT INTO workouts (uuid, user_id, date, status, sync_status, created_at, updated_at)
        VALUES (?, ?, '2026-01-01', 'finished', 'dirty', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
        uuid,
        userId
    )
}
const insertDirtySet = async (uuid: string, workoutId: number, exerciseId: number) => {
    await db.runAsync(
        `INSERT INTO sets (uuid, user_id, workout_id, exercise_id, position, sync_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, 'dirty', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
        uuid,
        userId,
        workoutId,
        exerciseId
    )
}

const localStatus = async (table: 'exercises' | 'workouts' | 'sets', uuid: string) => {
    const row = await db.getFirstAsync<{ sync_status: string }>(`SELECT sync_status FROM ${table} WHERE uuid = ?`, uuid)
    return row?.sync_status
}

describe('PushPipeline end-to-end via fake adapter', () => {
    it('pushes exercises + workouts + sets, batches parent lookups, and marks rows synced only after persistence', async () => {
        await insertDirtyExercise('ex-1')
        await insertDirtyExercise('ex-2')
        await insertDirtyWorkout('wk-1')
        await insertDirtyWorkout('wk-2')
        const ex = await db.getFirstAsync<{ id: number }>(`SELECT id FROM exercises WHERE uuid = 'ex-1'`)
        if (!ex) throw new Error('expected ex-1')
        const wk = await db.getFirstAsync<{ id: number }>(`SELECT id FROM workouts WHERE uuid = 'wk-1'`)
        if (!wk) throw new Error('expected wk-1')
        const wk2 = await db.getFirstAsync<{ id: number }>(`SELECT id FROM workouts WHERE uuid = 'wk-2'`)
        if (!wk2) throw new Error('expected wk-2')
        await insertDirtySet('set-1', wk.id, ex.id)
        await insertDirtySet('set-2', wk2.id, ex.id)

        const outbox = createOutbox(db as never, executeWriteTransaction)
        const writer = createRemoteWriter(adapter)
        const resolver = createRemoteIdResolver(adapter)

        const result = await drainOutbox(
            outbox,
            snapshot(),
            makePushFn(snapshot(), writer, resolver, noopPhotos),
            () => ({ userId }),
            (batch) => preloadSetParents(resolver, batch)
        )

        expect(result.aborted).toBe(false)
        expect(result.failed).toBe(0)
        expect(await localStatus('exercises', 'ex-1')).toBe('synced')
        expect(await localStatus('workouts', 'wk-1')).toBe('synced')
        expect(await localStatus('sets', 'set-1')).toBe('synced')
        expect(await localStatus('sets', 'set-2')).toBe('synced')

        // RemoteIdResolver acceptance: at most one query per parent type per cycle.
        const calls = adapter.callCounts().selectIdsByUuids
        expect(calls.workouts).toBe(1)
        expect(calls.exercises).toBe(1)
    })

    it('uploads photo bytes before the row push and cleans up superseded objects after persistence', async () => {
        await db.runAsync(
            `INSERT INTO exercises (uuid, user_id, name, type, photo_uri, photo_key, sync_status, created_at, updated_at)
            VALUES ('ex-1', ?, 'Bench', 'weight', 'file:///doc/exercises/171.jpg', 'ex-1-171.jpg', 'dirty', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
            userId
        )
        const calls: string[] = []
        const photos = {
            upload: async (uid: string, row: { photo_key: string | null }) => {
                calls.push(`upload:${uid}/${row.photo_key}`)
                return null
            },
            cleanup: async (uid: string, uuid: string, keepKey: string | null) => {
                calls.push(`cleanup:${uid}/${uuid}:keep=${keepKey}`)
            },
        }

        const outbox = createOutbox(db as never, executeWriteTransaction)
        const writer = createRemoteWriter(adapter)
        const resolver = createRemoteIdResolver(adapter)
        const result = await drainOutbox(
            outbox,
            snapshot(),
            makePushFn(snapshot(), writer, resolver, photos),
            () => ({ userId }),
            (batch) => preloadSetParents(resolver, batch)
        )

        expect(result.failed).toBe(0)
        expect(await localStatus('exercises', 'ex-1')).toBe('synced')
        expect(calls).toEqual(['upload:user-1/ex-1-171.jpg', 'cleanup:user-1/ex-1:keep=ex-1-171.jpg'])
        // The synced row carries the storage key, never the local file path.
        const pushed = adapter.snapshot('exercises')[0] as Record<string, unknown>
        expect(pushed.photo_key).toBe('ex-1-171.jpg')
        expect(pushed.photo_uri).toBeUndefined()
    })

    it('fails the row push (and leaves it retryable) when the photo upload fails', async () => {
        await db.runAsync(
            `INSERT INTO exercises (uuid, user_id, name, type, photo_uri, photo_key, sync_status, created_at, updated_at)
            VALUES ('ex-1', ?, 'Bench', 'weight', 'file:///doc/exercises/171.jpg', 'ex-1-171.jpg', 'dirty', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
            userId
        )
        const photos = {
            upload: async () => ({ kind: 'network-error' as const, message: 'offline' }),
            cleanup: async () => {},
        }

        const outbox = createOutbox(db as never, executeWriteTransaction)
        const writer = createRemoteWriter(adapter)
        const resolver = createRemoteIdResolver(adapter)
        const result = await drainOutbox(
            outbox,
            snapshot(),
            makePushFn(snapshot(), writer, resolver, photos),
            () => ({ userId }),
            (batch) => preloadSetParents(resolver, batch)
        )

        expect(result.failed).toBe(1)
        expect(await localStatus('exercises', 'ex-1')).toBe('failed')
        expect(adapter.snapshot('exercises')).toHaveLength(0)
    })

    it('does NOT mark a row synced when the remote silently returns no rows (empty-after-upsert)', async () => {
        await insertDirtyExercise('ex-1')

        const outbox = createOutbox(db as never, executeWriteTransaction)
        const writer = createRemoteWriter(adapter)
        const resolver = createRemoteIdResolver(adapter)

        adapter.queueFailure({ kind: 'empty-after-upsert' })

        const result = await drainOutbox(
            outbox,
            snapshot(),
            makePushFn(snapshot(), writer, resolver, noopPhotos),
            () => ({ userId }),
            (batch) => preloadSetParents(resolver, batch)
        )

        expect(result.failed).toBe(1)
        expect(await localStatus('exercises', 'ex-1')).toBe('failed')
        expect(adapter.snapshot('exercises')).toHaveLength(0)
    })
})
