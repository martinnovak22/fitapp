import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb, getTestDb, resetTestDb, useTestDb, type TestDb } from '@/src/test/setupTestDb'

vi.mock('@/src/db/client', () => ({
    getDb: async () => getTestDb(),
}))

const { runPrincipalTransition } = await import('../PrincipalTransition')

let db: TestDb

beforeEach(async () => {
    await resetTestDb()
    db = await createTestDb()
    useTestDb(db)
})

const insertGuestExercise = async (uuid: string) => {
    await db.runAsync(
        `INSERT INTO exercises (uuid, user_id, name, type, sync_status, created_at, updated_at)
        VALUES (?, NULL, ?, 'weight', 'local', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
        uuid,
        uuid
    )
}

const insertAccountWorkout = async (uuid: string, userId: string) => {
    await db.runAsync(
        `INSERT INTO workouts (uuid, user_id, date, status, sync_status, created_at, updated_at)
        VALUES (?, ?, '2026-01-01', 'finished', 'synced', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
        uuid,
        userId
    )
}

const countOf = async (table: string, scope: 'all' | 'guest' | string = 'all') => {
    const where =
        scope === 'all'
            ? ''
            : scope === 'guest'
              ? `WHERE user_id IS NULL`
              : `WHERE user_id = '${scope}'`
    const row = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) c FROM ${table} ${where}`)
    return row?.c ?? 0
}

describe('runPrincipalTransition', () => {
    it('guest → account with preserve: assigns user_id and marks rows dirty inside one transaction', async () => {
        await insertGuestExercise('ex-1')
        await insertGuestExercise('ex-2')

        const outcome = await runPrincipalTransition({
            from: { kind: 'guest' },
            to: { kind: 'account', userId: 'user-A' },
            policy: 'preserve',
        })

        expect(outcome.kind).toBe('ok')
        if (outcome.kind === 'ok') {
            expect(outcome.rowsMigrated).toBeGreaterThanOrEqual(2)
            expect(outcome.rowsCleared).toBe(0)
        }
        expect(await countOf('exercises', 'guest')).toBe(0)
        expect(await countOf('exercises', 'user-A')).toBe(2)
        const row = await db.getFirstAsync<{ sync_status: string }>(
            `SELECT sync_status FROM exercises WHERE uuid = 'ex-1'`
        )
        expect(row?.sync_status).toBe('dirty')
    })

    it('account-A → account-B with clear: empties all data tables', async () => {
        await insertAccountWorkout('wk-1', 'user-A')
        await insertAccountWorkout('wk-2', 'user-A')

        const outcome = await runPrincipalTransition({
            from: { kind: 'account', userId: 'user-A' },
            to: { kind: 'account', userId: 'user-B' },
            policy: 'clear',
        })

        expect(outcome.kind).toBe('ok')
        expect(await countOf('workouts')).toBe(0)
        expect(await countOf('exercises')).toBe(0)
        expect(await countOf('sets')).toBe(0)
    })

    it('account → guest with clear: empties data tables and resets sync_state', async () => {
        await insertAccountWorkout('wk-1', 'user-A')
        await db.runAsync(
            `UPDATE sync_state SET is_syncing = 1, outbox_size = 5, last_error = 'boom' WHERE id = 1`
        )

        const outcome = await runPrincipalTransition({
            from: { kind: 'account', userId: 'user-A' },
            to: { kind: 'guest' },
            policy: 'clear',
        })

        expect(outcome.kind).toBe('ok')
        expect(await countOf('workouts')).toBe(0)
        const state = await db.getFirstAsync<{
            is_syncing: number
            outbox_size: number
            last_error: string | null
        }>(`SELECT is_syncing, outbox_size, last_error FROM sync_state WHERE id = 1`)
        expect(state?.is_syncing).toBe(0)
        expect(state?.outbox_size).toBe(0)
        expect(state?.last_error).toBeNull()
    })

    it('account → signed-out with clear: empties data tables', async () => {
        await insertAccountWorkout('wk-1', 'user-A')

        const outcome = await runPrincipalTransition({
            from: { kind: 'account', userId: 'user-A' },
            to: { kind: 'signed-out' },
            policy: 'clear',
        })

        expect(outcome.kind).toBe('ok')
        expect(await countOf('workouts')).toBe(0)
    })

    it('returns noop when from and to are the same identity', async () => {
        await insertAccountWorkout('wk-1', 'user-A')

        const outcome = await runPrincipalTransition({
            from: { kind: 'account', userId: 'user-A' },
            to: { kind: 'account', userId: 'user-A' },
            policy: 'clear',
        })

        expect(outcome.kind).toBe('noop')
        expect(await countOf('workouts', 'user-A')).toBe(1)
    })

    it('preserve from anything other than guest → account returns a structured error', async () => {
        await insertAccountWorkout('wk-1', 'user-A')

        const outcome = await runPrincipalTransition({
            from: { kind: 'account', userId: 'user-A' },
            to: { kind: 'account', userId: 'user-B' },
            policy: 'preserve',
        })

        expect(outcome.kind).toBe('error')
        if (outcome.kind === 'error') {
            expect(outcome.message).toMatch(/preserve/i)
        }
        // Single-transaction guarantee: nothing changed.
        expect(await countOf('workouts', 'user-A')).toBe(1)
    })

    it('rolls back the entire transition if any step throws (single-transaction guarantee)', async () => {
        await insertGuestExercise('ex-1')
        // Inject a failure on the second UPDATE by replacing runAsync to throw on workouts.
        const original = db.runAsync
        let calls = 0
        const wrapped = (async (sql: string, ...params: unknown[]) => {
            calls += 1
            if (sql.includes('UPDATE workouts')) {
                throw new Error('simulated mid-transition crash')
            }
            return original(sql, ...params)
        }) as typeof original
        // The test DB's runAsync is the one writeQueue dispatches to.
        db.runAsync = wrapped

        const outcome = await runPrincipalTransition({
            from: { kind: 'guest' },
            to: { kind: 'account', userId: 'user-A' },
            policy: 'preserve',
        })

        // Restore so post-assertions can read the DB.
        db.runAsync = original
        expect(outcome.kind).toBe('error')
        expect(calls).toBeGreaterThan(0)
        // The guest row is still a guest row — the migrate UPDATE on exercises
        // ran first but the whole transaction rolled back.
        expect(await countOf('exercises', 'guest')).toBe(1)
        expect(await countOf('exercises', 'user-A')).toBe(0)
    })
})
