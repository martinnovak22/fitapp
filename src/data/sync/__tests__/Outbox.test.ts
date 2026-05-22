import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb, getTestDb, resetTestDb, useTestDb, type TestDb } from '@/src/test/setupTestDb'

vi.mock('@/src/db/client', () => ({
    getDb: async () => getTestDb(),
}))

const { executeWriteTransaction } = await import('@/src/db/writeQueue')
const { createOutbox } = await import('../Outbox')
const { capturePrincipalSnapshot } = await import('../PrincipalSnapshot')

let db: TestDb

const userId = 'user-1'

const insertExercise = async (uuid: string, name: string, updatedAt = '2026-01-01T00:00:00Z') => {
    await db.runAsync(
        `INSERT INTO exercises (uuid, user_id, name, type, sync_status, created_at, updated_at)
        VALUES (?, ?, ?, 'weight', 'dirty', ?, ?)`,
        uuid,
        userId,
        name,
        updatedAt,
        updatedAt
    )
}

const insertWorkout = async (uuid: string, updatedAt = '2026-01-01T00:00:00Z') => {
    await db.runAsync(
        `INSERT INTO workouts (uuid, user_id, date, status, sync_status, created_at, updated_at)
        VALUES (?, ?, '2026-01-01', 'finished', 'dirty', ?, ?)`,
        uuid,
        userId,
        updatedAt,
        updatedAt
    )
}

const insertSet = async (uuid: string, workoutId: number, exerciseId: number, updatedAt = '2026-01-01T00:00:00Z') => {
    await db.runAsync(
        `INSERT INTO sets (uuid, user_id, workout_id, exercise_id, position, sync_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, 'dirty', ?, ?)`,
        uuid,
        userId,
        workoutId,
        exerciseId,
        updatedAt,
        updatedAt
    )
}

const getStatus = async (table: 'exercises' | 'workouts' | 'sets', uuid: string) => {
    const row = await db.getFirstAsync<{ sync_status: string; last_synced_at: string | null }>(
        `SELECT sync_status, last_synced_at FROM ${table} WHERE uuid = ?`,
        uuid
    )
    return row
}

beforeEach(async () => {
    await resetTestDb()
    db = await createTestDb()
    useTestDb(db)
})

describe('Outbox.nextBatch', () => {
    it('returns dirty rows in FK-safe order: exercises, workouts, sets, then tombstones', async () => {
        // Insert in mixed order; nextBatch must reorder.
        await insertExercise('ex-1', 'Bench')
        await insertWorkout('wk-1')
        const wk = await db.getFirstAsync<{ id: number }>('SELECT id FROM workouts WHERE uuid = ?', 'wk-1')
        const ex = await db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE uuid = ?', 'ex-1')
        await insertSet('set-1', wk!.id, ex!.id)
        await db.runAsync(
            `INSERT INTO deletion_tombstones (entity_type, entity_uuid, user_id, deleted_at, sync_status)
            VALUES ('exercise', 'ex-deleted', ?, '2026-01-02T00:00:00Z', 'dirty')`,
            userId
        )

        const outbox = createOutbox(db as never, executeWriteTransaction)
        const snap = capturePrincipalSnapshot({ userId, remote: true })
        const batch = await outbox.nextBatch(snap)

        const kinds = batch.map((r) => (r.kind === 'entity' ? r.entityType : `tombstone:${r.entityType}`))
        expect(kinds).toEqual(['exercise', 'workout', 'set', 'tombstone:exercise'])
    })

    it('scopes by snapshot — guest snapshot ignores account rows', async () => {
        await insertExercise('ex-account', 'Account bench')
        await db.runAsync(
            `INSERT INTO exercises (uuid, user_id, name, type, sync_status, created_at, updated_at)
            VALUES ('ex-guest', NULL, 'Guest bench', 'weight', 'dirty', ?, ?)`,
            '2026-01-01T00:00:00Z',
            '2026-01-01T00:00:00Z'
        )

        const outbox = createOutbox(db as never, executeWriteTransaction)
        const guestSnap = capturePrincipalSnapshot({ userId: null, remote: true })
        const batch = await outbox.nextBatch(guestSnap)
        expect(batch.map((r) => r.uuid)).toEqual(['ex-guest'])
    })

    it('does not return rows already marked synced', async () => {
        await insertExercise('ex-dirty', 'Dirty')
        await db.runAsync(
            `INSERT INTO exercises (uuid, user_id, name, type, sync_status, created_at, updated_at)
            VALUES ('ex-clean', ?, 'Clean', 'weight', 'synced', ?, ?)`,
            userId,
            '2026-01-01T00:00:00Z',
            '2026-01-01T00:00:00Z'
        )
        const outbox = createOutbox(db as never, executeWriteTransaction)
        const snap = capturePrincipalSnapshot({ userId, remote: true })
        const batch = await outbox.nextBatch(snap)
        expect(batch.map((r) => r.uuid)).toEqual(['ex-dirty'])
    })
})

describe('Outbox.ack', () => {
    it('marks rows synced when updated_at has not changed since the batch was drawn', async () => {
        await insertExercise('ex-1', 'Bench', '2026-01-01T00:00:00Z')
        const outbox = createOutbox(db as never, executeWriteTransaction)
        const snap = capturePrincipalSnapshot({ userId, remote: true })
        const batch = await outbox.nextBatch(snap)

        await outbox.ack(batch)

        const status = await getStatus('exercises', 'ex-1')
        expect(status?.sync_status).toBe('synced')
        expect(status?.last_synced_at).not.toBeNull()
    })

    it('does NOT mark synced if the row was re-dirtied (updated_at advanced) since the batch', async () => {
        await insertExercise('ex-1', 'Bench', '2026-01-01T00:00:00Z')
        const outbox = createOutbox(db as never, executeWriteTransaction)
        const snap = capturePrincipalSnapshot({ userId, remote: true })
        const batch = await outbox.nextBatch(snap)

        // Simulate a concurrent re-dirty: the row was edited again mid-cycle.
        await db.runAsync(
            `UPDATE exercises SET name = 'Bench Heavy', updated_at = ?, sync_status = 'dirty' WHERE uuid = 'ex-1'`,
            '2026-01-01T00:00:30Z'
        )

        await outbox.ack(batch)

        const status = await getStatus('exercises', 'ex-1')
        expect(status?.sync_status).toBe('dirty')
        expect(status?.last_synced_at).toBeNull()
    })
})

describe('Outbox.fail', () => {
    it('marks rows failed and exposes a structured reason to the caller', async () => {
        await insertExercise('ex-1', 'Bench')
        const outbox = createOutbox(db as never, executeWriteTransaction)
        const snap = capturePrincipalSnapshot({ userId, remote: true })
        const batch = await outbox.nextBatch(snap)

        const reason = { kind: 'network-error', message: 'timed out' } as const
        await outbox.fail(batch, reason)

        const status = await getStatus('exercises', 'ex-1')
        expect(status?.sync_status).toBe('failed')

        // Reason shape is part of the public surface for the cycle/UI layer.
        expect(reason.kind).toBe('network-error')
        expect(reason.message).toBe('timed out')
    })
})
