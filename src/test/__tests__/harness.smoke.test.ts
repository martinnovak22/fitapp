import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabaseAdapter } from '../fakeSupabase'
import { createTestDb, getTestDb, resetTestDb, type TestDb, useTestDb } from '../setupTestDb'

// Route the product code's getDb() at the in-memory test DB so the real
// serialized write queue (executeWrite / executeWriteTransaction) runs against it.
vi.mock('@/src/db/client', () => ({
    getDb: async () => getTestDb(),
}))

// Imported AFTER the mock so writeQueue picks up the routed getDb().
const { executeWrite, executeWriteTransaction } = await import('@/src/db/writeQueue')

let db: TestDb

beforeEach(async () => {
    await resetTestDb()
    db = await createTestDb()
    useTestDb(db)
})

describe('test harness smoke', () => {
    it('boots a schema-loaded in-memory DB with the expected tables', async () => {
        const tables = await db.getAllAsync<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        const names = tables.map((t) => t.name)
        expect(names).toEqual(
            expect.arrayContaining(['exercises', 'workouts', 'sets', 'deletion_tombstones', 'sync_state'])
        )
    })

    it('writes through the serialized write queue, uploads through the fake adapter, and reflects state on both sides', async () => {
        const adapter = createFakeSupabaseAdapter()
        const userId = 'user-abc'

        // 1. Write a row locally through the real write queue, marked dirty.
        await executeWriteTransaction(async (innerDb) => {
            await innerDb.runAsync(
                `INSERT INTO exercises (uuid, user_id, name, type, sync_status, created_at, updated_at)
                 VALUES (?, ?, ?, 'weight', 'dirty', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
                'ex-uuid-1',
                userId,
                'Bench Press'
            )
        })

        // 2. Push the dirty row through the fake adapter.
        const local = await db.getFirstAsync<{
            uuid: string
            name: string
            user_id: string
            updated_at: string
        }>('SELECT uuid, name, user_id, updated_at FROM exercises WHERE uuid = ?', 'ex-uuid-1')
        expect(local).not.toBeNull()

        const acks = await adapter.upsert('exercises', [
            {
                uuid: local!.uuid,
                user_id: local!.user_id,
                name: local!.name,
                updated_at: local!.updated_at,
            },
        ])
        expect(acks).toEqual([{ id: 1, uuid: 'ex-uuid-1' }])

        // 3. Mark the row synced locally (also through the write queue).
        await executeWrite((innerDb) =>
            innerDb.runAsync(
                `UPDATE exercises SET sync_status = 'synced', last_synced_at = ? WHERE uuid = ?`,
                '2026-01-01T00:00:01Z',
                'ex-uuid-1'
            )
        )

        // 4. Assert both sides agree.
        const localFinal = await db.getFirstAsync<{ sync_status: string; last_synced_at: string }>(
            'SELECT sync_status, last_synced_at FROM exercises WHERE uuid = ?',
            'ex-uuid-1'
        )
        expect(localFinal?.sync_status).toBe('synced')
        expect(localFinal?.last_synced_at).toBe('2026-01-01T00:00:01Z')

        const remote = adapter.snapshot('exercises')
        expect(remote).toHaveLength(1)
        expect(remote[0]).toMatchObject({ uuid: 'ex-uuid-1', name: 'Bench Press', user_id: userId })
    })

    it('fake adapter can simulate the three failure modes per call', async () => {
        const adapter = createFakeSupabaseAdapter()

        adapter.queueFailure({ kind: 'network-error' })
        await expect(adapter.upsert('exercises', [{ uuid: 'a', user_id: 'u', name: 'x' }])).rejects.toThrow(/network/i)

        adapter.queueFailure({ kind: 'empty-after-upsert' })
        const silentlyEmpty = await adapter.upsert('exercises', [{ uuid: 'b', user_id: 'u', name: 'y' }])
        expect(silentlyEmpty).toEqual([])
        // The dangerous bit: the local code path would treat this as "synced",
        // but the row was NOT persisted remotely.
        expect(adapter.snapshot('exercises')).toHaveLength(0)

        const ok = await adapter.upsert('exercises', [{ uuid: 'c', user_id: 'u', name: 'z' }])
        expect(ok).toEqual([{ id: 1, uuid: 'c' }])
    })
})
