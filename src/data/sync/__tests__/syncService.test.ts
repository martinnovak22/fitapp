import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb, getTestDb, resetTestDb, useTestDb, type TestDb } from '@/src/test/setupTestDb'

vi.mock('@/src/db/client', () => ({
    getDb: async () => getTestDb(),
}))

vi.mock('@/src/data/remote/supabase/config', () => ({
    getSupabaseConfig: () => ({ url: 'https://example.test', publicKey: 'anon' }),
}))

vi.mock('@/src/data/remote/supabase/session', () => ({
    getSupabaseSession: () => ({ accessToken: 'token', userId: 'user-1' }),
}))

vi.mock('@/src/modules/auth/authMode', () => ({
    isRemoteDataMode: () => true,
}))

const { runSync, resetPullCursorsForTest } = await import('../syncService')

let db: TestDb
const userId = 'user-1'

type FetchCall = { url: string; method: string }
const fetchCalls: FetchCall[] = []

const mockFetch = (handler: (call: FetchCall) => { ok?: boolean; status?: number; body?: unknown }) => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const u = typeof url === 'string' ? url : url.toString()
        const method = init?.method ?? 'GET'
        const call = { url: u, method }
        fetchCalls.push(call)
        const result = handler(call)
        const body = result.body === undefined ? '' : JSON.stringify(result.body)
        return new Response(body, { status: result.status ?? 200 }) as unknown as Response
    }) as typeof fetch
}

beforeEach(async () => {
    await resetTestDb()
    db = await createTestDb()
    useTestDb(db)
    fetchCalls.length = 0
    resetPullCursorsForTest()
})

describe('runSync — issue #26 cheap-exit and cursor', () => {
    it('skips the push stage entirely when outbox is empty and reports zero work', async () => {
        // No dirty rows. Pulls return empty arrays.
        mockFetch(() => ({ body: [] }))

        const result = await runSync()

        expect(result).toMatchObject({ skipped: false, pushed: 0, pulled: 0, failed: 0, aborted: false })
        // No PATCH or POST calls (those only happen during push).
        const writes = fetchCalls.filter((c) => c.method === 'POST' || c.method === 'PATCH')
        expect(writes).toEqual([])
    })

    it('advances the in-memory pull cursor so subsequent cycles request only newer rows', async () => {
        let exCallCount = 0
        mockFetch((call) => {
            if (call.url.includes('/exercises?') && call.method === 'GET' && !call.url.includes('deleted_at=not')) {
                exCallCount += 1
                if (exCallCount === 1) {
                    return {
                        body: [
                            {
                                uuid: 'ex-a',
                                user_id: userId,
                                name: 'Bench',
                                type: 'weight',
                                muscle_group: null,
                                photo_uri: null,
                                position: 0,
                                created_at: '2026-02-01T00:00:00Z',
                                updated_at: '2026-02-01T00:00:00Z',
                                deleted_at: null,
                            },
                        ],
                    }
                }
            }
            return { body: [] }
        })

        const first = await runSync()
        expect(first.pulled).toBeGreaterThanOrEqual(1)

        // Second cycle should attach updated_at=gt.<cursor> filter on the
        // exercises pull, demonstrating the cursor advanced.
        const callsBefore = fetchCalls.length
        const second = await runSync()
        expect(second.pulled).toBe(0)

        const secondCycleCalls = fetchCalls.slice(callsBefore)
        const exercisesPull = secondCycleCalls.find(
            (c) => c.url.includes('/exercises?') && c.url.includes('deleted_at=is.null')
        )
        expect(exercisesPull?.url).toContain('updated_at=gt.2026-02-01T00%3A00%3A00Z')
    })
})
