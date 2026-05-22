import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb, getTestDb, resetTestDb, useTestDb, type TestDb } from '@/src/test/setupTestDb'

vi.mock('@/src/db/client', () => ({
    getDb: async () => getTestDb(),
}))

const { executeWriteTransaction } = await import('@/src/db/writeQueue')
const { createOutbox } = await import('../Outbox')
const { capturePrincipalSnapshot } = await import('../PrincipalSnapshot')
const { drainOutbox } = await import('../SyncCycle')

let db: TestDb
const userId = 'user-1'

beforeEach(async () => {
    await resetTestDb()
    db = await createTestDb()
    useTestDb(db)
})

const insertDirtyExercise = async (uuid: string, updatedAt: string) => {
    await db.runAsync(
        `INSERT INTO exercises (uuid, user_id, name, type, sync_status, created_at, updated_at)
        VALUES (?, ?, ?, 'weight', 'dirty', ?, ?)`,
        uuid,
        userId,
        uuid,
        updatedAt,
        updatedAt
    )
}

describe('drainOutbox — mid-cycle principal divergence', () => {
    it('aborts before processing the next row when the live principal diverges from the snapshot', async () => {
        await insertDirtyExercise('ex-a', '2026-01-01T00:00:00Z')
        await insertDirtyExercise('ex-b', '2026-01-01T00:00:01Z')
        await insertDirtyExercise('ex-c', '2026-01-01T00:00:02Z')

        const outbox = createOutbox(db as never, executeWriteTransaction)
        const snap = capturePrincipalSnapshot({ userId, remote: true })

        let live: { userId: string | null; remote: boolean } = { userId, remote: true }
        let pushed = 0
        const push = async () => {
            pushed += 1
            // Mid-cycle: after the first row pushes, the user signs out.
            if (pushed === 1) live = { userId: null, remote: true }
            return { kind: 'ack' as const }
        }

        const result = await drainOutbox(outbox, snap, push, () => live)

        expect(pushed).toBe(1)
        expect(result.aborted).toBe(true)
        expect(result.acked).toBe(1)
        // Only the first row was acked; the other two remain dirty.
        const stillDirty = await db.getAllAsync<{ uuid: string }>(
            `SELECT uuid FROM exercises WHERE sync_status = 'dirty' ORDER BY uuid`
        )
        expect(stillDirty.map((r) => r.uuid)).toEqual(['ex-b', 'ex-c'])
    })

    it('drains the full batch when the principal stays stable', async () => {
        await insertDirtyExercise('ex-a', '2026-01-01T00:00:00Z')
        await insertDirtyExercise('ex-b', '2026-01-01T00:00:01Z')

        const outbox = createOutbox(db as never, executeWriteTransaction)
        const snap = capturePrincipalSnapshot({ userId, remote: true })

        const result = await drainOutbox(
            outbox,
            snap,
            async () => ({ kind: 'ack' as const }),
            () => ({ userId, remote: true })
        )

        expect(result.aborted).toBe(false)
        expect(result.acked).toBe(2)
        const remaining = await db.getAllAsync<{ uuid: string }>(
            `SELECT uuid FROM exercises WHERE sync_status = 'dirty'`
        )
        expect(remaining).toEqual([])
    })
})
