import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb, getTestDb, resetTestDb, useTestDb, type TestDb } from '@/src/test/setupTestDb'
import { createFakeSupabaseAdapter, type FakeSupabaseAdapter } from '@/src/test/fakeSupabase'

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
const snapshot = () => capturePrincipalSnapshot({ userId, remote: true })

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
        const wk = await db.getFirstAsync<{ id: number }>(`SELECT id FROM workouts WHERE uuid = 'wk-1'`)
        const wk2 = await db.getFirstAsync<{ id: number }>(`SELECT id FROM workouts WHERE uuid = 'wk-2'`)
        await insertDirtySet('set-1', wk!.id, ex!.id)
        await insertDirtySet('set-2', wk2!.id, ex!.id)

        const outbox = createOutbox(db as never, executeWriteTransaction)
        const writer = createRemoteWriter(adapter)
        const resolver = createRemoteIdResolver(adapter)

        const result = await drainOutbox(
            outbox,
            snapshot(),
            makePushFn(snapshot(), writer, resolver),
            () => ({ userId, remote: true }),
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

    it('does NOT mark a row synced when the remote silently returns no rows (empty-after-upsert)', async () => {
        await insertDirtyExercise('ex-1')

        const outbox = createOutbox(db as never, executeWriteTransaction)
        const writer = createRemoteWriter(adapter)
        const resolver = createRemoteIdResolver(adapter)

        adapter.queueFailure({ kind: 'empty-after-upsert' })

        const result = await drainOutbox(
            outbox,
            snapshot(),
            makePushFn(snapshot(), writer, resolver),
            () => ({ userId, remote: true }),
            (batch) => preloadSetParents(resolver, batch)
        )

        expect(result.failed).toBe(1)
        expect(await localStatus('exercises', 'ex-1')).toBe('failed')
        expect(adapter.snapshot('exercises')).toHaveLength(0)
    })
})
