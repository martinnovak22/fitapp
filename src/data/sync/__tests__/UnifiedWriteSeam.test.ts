// Asserts the unified-write-seam invariant: a user write and a sync ack on
// the same row, queued concurrently through executeWriteTransaction, produce
// a consistent final state. Specifically: the user's update is never lost,
// and the sync ack does not mark a re-dirtied row as synced.

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

beforeEach(async () => {
    await resetTestDb()
    db = await createTestDb()
    useTestDb(db)
})

describe('unified write seam: concurrent user-write + sync-ack', () => {
    it('a user update queued before the sync ack wins; ack is rejected because updated_at advanced', async () => {
        await db.runAsync(
            `INSERT INTO exercises (uuid, user_id, name, type, sync_status, created_at, updated_at)
            VALUES ('ex-1', ?, 'Bench', 'weight', 'dirty', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
            userId
        )

        const outbox = createOutbox(db as never, executeWriteTransaction)
        const snapshot = capturePrincipalSnapshot({ userId, remote: true })
        const batch = await outbox.nextBatch(snapshot)
        expect(batch).toHaveLength(1)

        // Both writes go through the unified seam. The user's UPDATE is queued
        // first, the sync ack second — the queue serializes them.
        const userWrite = executeWriteTransaction((innerDb) =>
            innerDb.runAsync(
                `UPDATE exercises SET name = ?, updated_at = ?, sync_status = 'dirty' WHERE uuid = 'ex-1'`,
                'Bench Heavy',
                '2026-01-01T00:00:42Z'
            )
        )
        const ack = outbox.ack(batch)

        await Promise.all([userWrite, ack])

        const row = await db.getFirstAsync<{
            name: string
            sync_status: string
            updated_at: string
            last_synced_at: string | null
        }>(`SELECT name, sync_status, updated_at, last_synced_at FROM exercises WHERE uuid = 'ex-1'`)

        // User update preserved.
        expect(row?.name).toBe('Bench Heavy')
        expect(row?.updated_at).toBe('2026-01-01T00:00:42Z')
        // Ack was rejected because the row had been re-dirtied; row is still
        // dirty so the next cycle will pick it up.
        expect(row?.sync_status).toBe('dirty')
        expect(row?.last_synced_at).toBeNull()
    })

    it('a user update queued after the sync ack does not corrupt last_synced_at (writes are serialized, not interleaved)', async () => {
        await db.runAsync(
            `INSERT INTO exercises (uuid, user_id, name, type, sync_status, created_at, updated_at)
            VALUES ('ex-1', ?, 'Bench', 'weight', 'dirty', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
            userId
        )

        const outbox = createOutbox(db as never, executeWriteTransaction)
        const snapshot = capturePrincipalSnapshot({ userId, remote: true })
        const batch = await outbox.nextBatch(snapshot)

        const ack = outbox.ack(batch)
        const userWrite = executeWriteTransaction((innerDb) =>
            innerDb.runAsync(
                `UPDATE exercises SET name = ?, updated_at = ?, sync_status = 'dirty' WHERE uuid = 'ex-1'`,
                'Bench Heavy',
                '2026-01-02T00:00:00Z'
            )
        )

        await Promise.all([ack, userWrite])

        const row = await db.getFirstAsync<{
            name: string
            sync_status: string
            updated_at: string
            last_synced_at: string | null
        }>(`SELECT name, sync_status, updated_at, last_synced_at FROM exercises WHERE uuid = 'ex-1'`)

        // The ack committed first (row got synced), then the user write
        // re-dirtied it with the newer name. Final state is consistent:
        // user's name and updated_at win, sync_status is back to dirty.
        expect(row?.name).toBe('Bench Heavy')
        expect(row?.sync_status).toBe('dirty')
        expect(row?.updated_at).toBe('2026-01-02T00:00:00Z')
        // last_synced_at was set by the ack and not cleared by the user write
        // — that's fine; the dirty flag is the source of truth for sync.
        expect(row?.last_synced_at).not.toBeNull()
    })
})
