import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePrincipal } from '@/src/data/principal'
import { createTestDb, getTestDb, resetTestDb, type TestDb, useTestDb } from '@/src/test/setupTestDb'

vi.mock('@/src/db/client', () => ({
    getDb: async () => getTestDb(),
}))

vi.mock('@/src/data/remote/supabase/config', () => ({
    getSupabaseConfig: () => ({ url: 'https://example.test', publicKey: 'anon' }),
}))

const { refreshMock, tokenState } = vi.hoisted(() => ({
    refreshMock: vi.fn(async () => null as string | null),
    tokenState: { current: 'token' },
}))

vi.mock('@/src/data/remote/supabase/session', () => ({
    getSupabaseSession: () => ({ accessToken: tokenState.current, userId: 'user-1' }),
    refreshSupabaseAccessToken: () => refreshMock(),
}))

vi.mock('@/src/modules/auth/authMode', () => ({
    isRemoteDataMode: () => true,
}))

const { runSync, resetPullCursorsForTest, getSyncState, retryBlockedRows } = await import('../syncService')
const { syncStatusStore } = await import('../SyncStatus')

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
    syncStatusStore.set({ kind: 'idle' })
    refreshMock.mockReset()
    refreshMock.mockResolvedValue(null)
    tokenState.current = 'token'
})

const isExercisesUpsertPull = (call: FetchCall) =>
    call.method === 'GET' && call.url.includes('/exercises?') && call.url.includes('deleted_at=is.null')

const insertDirtyExercise = async (uuid: string) => {
    await db.runAsync(
        `INSERT INTO exercises (uuid, user_id, name, type, sync_status, created_at, updated_at)
        VALUES (?, ?, ?, 'weight', 'dirty', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
        uuid,
        userId,
        uuid
    )
}

const localStatus = async (uuid: string) => {
    const row = await db.getFirstAsync<{ sync_status: string }>(
        'SELECT sync_status FROM exercises WHERE uuid = ?',
        uuid
    )
    return row?.sync_status
}

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

    it('orders deletion pulls by deleted_at so a truncated response cannot advance the cursor past unseen rows', async () => {
        mockFetch(() => ({ body: [] }))

        await runSync()

        // The upsert pulls are cursor-safe under server-side truncation because
        // they are sorted ascending; the deletion pulls need the same guarantee.
        const deletionPulls = fetchCalls.filter((c) => c.method === 'GET' && c.url.includes('deleted_at=not.is.null'))
        expect(deletionPulls.length).toBe(3)
        for (const call of deletionPulls) {
            expect(call.url).toContain('order=deleted_at.asc')
        }
    })

    it('clears the pull cursor on a principal change so the next pull starts from scratch', async () => {
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

        // First cycle advances the cursor to 2026-02-01.
        await runSync()

        // A principal transition (here, an account switch) must wipe the
        // in-memory cursor so the following cycle re-pulls from the beginning
        // rather than skipping rows behind the stale watermark.
        setActivePrincipal({ mode: 'account', userId: 'user-2' })

        const callsBefore = fetchCalls.length
        await runSync()

        const secondCycleCalls = fetchCalls.slice(callsBefore)
        const exercisesPull = secondCycleCalls.find(
            (c) => c.url.includes('/exercises?') && c.url.includes('deleted_at=is.null')
        )
        expect(exercisesPull).toBeDefined()
        expect(exercisesPull?.url).not.toContain('updated_at=gt')
    })
})

describe('runSync — pull reconciliation upserts remote rows into local', () => {
    it('inserts a remote exercise, workout, and set in one cycle and marks them synced', async () => {
        mockFetch((call) => {
            const isUpsertPull = call.method === 'GET' && call.url.includes('deleted_at=is.null')
            if (isUpsertPull && call.url.includes('/exercises?')) {
                return {
                    body: [
                        {
                            uuid: 'ex-a',
                            user_id: userId,
                            name: 'Bench',
                            type: 'weight',
                            muscle_group: 'chest',
                            photo_uri: null,
                            position: 0,
                            created_at: '2026-02-01T00:00:00Z',
                            updated_at: '2026-02-01T00:00:00Z',
                            deleted_at: null,
                        },
                    ],
                }
            }
            if (isUpsertPull && call.url.includes('/workouts?')) {
                return {
                    body: [
                        {
                            uuid: 'w-a',
                            user_id: userId,
                            date: '2026-02-01',
                            start_time: '08:00',
                            end_time: null,
                            status: 'in_progress',
                            note: 'morning',
                            created_at: '2026-02-01T00:00:00Z',
                            updated_at: '2026-02-01T00:00:00Z',
                            deleted_at: null,
                        },
                    ],
                }
            }
            if (isUpsertPull && call.url.includes('/sets?')) {
                return {
                    body: [
                        {
                            uuid: 's-a',
                            user_id: userId,
                            weight: 100,
                            reps: 5,
                            distance: null,
                            duration: null,
                            rpe: 8,
                            position: 0,
                            sub_sets: null,
                            created_at: '2026-02-01T00:00:00Z',
                            updated_at: '2026-02-01T00:00:00Z',
                            deleted_at: null,
                            workouts: { uuid: 'w-a' },
                            exercises: { uuid: 'ex-a' },
                        },
                    ],
                }
            }
            return { body: [] }
        })

        const result = await runSync()
        expect(result.pulled).toBeGreaterThanOrEqual(3)

        const exercise = await db.getFirstAsync<{ name: string; type: string; sync_status: string }>(
            'SELECT name, type, sync_status FROM exercises WHERE uuid = ?',
            'ex-a'
        )
        expect(exercise).toMatchObject({ name: 'Bench', type: 'weight', sync_status: 'synced' })

        const workout = await db.getFirstAsync<{ date: string; status: string; note: string; sync_status: string }>(
            'SELECT date, status, note, sync_status FROM workouts WHERE uuid = ?',
            'w-a'
        )
        expect(workout).toMatchObject({
            date: '2026-02-01',
            status: 'in_progress',
            note: 'morning',
            sync_status: 'synced',
        })

        const set = await db.getFirstAsync<{ weight: number; reps: number; rpe: number; sync_status: string }>(
            'SELECT weight, reps, rpe, sync_status FROM sets WHERE uuid = ?',
            's-a'
        )
        expect(set).toMatchObject({ weight: 100, reps: 5, rpe: 8, sync_status: 'synced' })
    })

    it('keeps a dirty local row that is newer than the incoming remote row (last-writer-wins)', async () => {
        await insertDirtyExercise('ex-keep')
        // Local dirty row is dated 2026-01-01 (see helper). Remote claims an
        // older 2025-01-01 update, so the local copy must win and stay dirty.
        mockFetch((call) => {
            const isUpsertPull = call.method === 'GET' && call.url.includes('deleted_at=is.null')
            if (isUpsertPull && call.url.includes('/exercises?')) {
                return {
                    body: [
                        {
                            uuid: 'ex-keep',
                            user_id: userId,
                            name: 'Remote Name',
                            type: 'weight',
                            muscle_group: null,
                            photo_uri: null,
                            position: 0,
                            created_at: '2025-01-01T00:00:00Z',
                            updated_at: '2025-01-01T00:00:00Z',
                            deleted_at: null,
                        },
                    ],
                }
            }
            return { body: [] }
        })

        await runSync()

        const exercise = await db.getFirstAsync<{ name: string }>(
            'SELECT name FROM exercises WHERE uuid = ?',
            'ex-keep'
        )
        // Remote name was NOT applied; the newer local copy won the merge.
        expect(exercise?.name).toBe('ex-keep')
    })

    it('does not advance the sets cursor past a set whose parent workout is absent, and links it once the parent arrives', async () => {
        let workoutPresent = false
        mockFetch((call) => {
            const isUpsertPull = call.method === 'GET' && call.url.includes('deleted_at=is.null')
            // Cursored re-pulls return nothing new; only the initial (uncursored)
            // pull of each table serves rows.
            if (isUpsertPull && call.url.includes('updated_at=gt')) return { body: [] }
            if (isUpsertPull && call.url.includes('/exercises?')) {
                return {
                    body: [
                        {
                            uuid: 'ex-a',
                            user_id: userId,
                            name: 'Bench',
                            type: 'weight',
                            muscle_group: 'chest',
                            photo_uri: null,
                            position: 0,
                            created_at: '2026-02-01T00:00:00Z',
                            updated_at: '2026-02-01T00:00:00Z',
                            deleted_at: null,
                        },
                    ],
                }
            }
            if (isUpsertPull && call.url.includes('/workouts?')) {
                if (!workoutPresent) return { body: [] }
                return {
                    body: [
                        {
                            uuid: 'w-a',
                            user_id: userId,
                            date: '2026-02-01',
                            start_time: '08:00',
                            end_time: null,
                            status: 'in_progress',
                            note: null,
                            created_at: '2026-02-01T00:00:00Z',
                            updated_at: '2026-02-01T00:00:00Z',
                            deleted_at: null,
                        },
                    ],
                }
            }
            if (isUpsertPull && call.url.includes('/sets?')) {
                return {
                    body: [
                        {
                            uuid: 's-a',
                            user_id: userId,
                            weight: 100,
                            reps: 5,
                            distance: null,
                            duration: null,
                            rpe: 8,
                            position: 0,
                            sub_sets: null,
                            created_at: '2026-02-01T00:00:00Z',
                            updated_at: '2026-02-01T00:00:00Z',
                            deleted_at: null,
                            workouts: { uuid: 'w-a' },
                            exercises: { uuid: 'ex-a' },
                        },
                    ],
                }
            }
            return { body: [] }
        })

        // Cycle 1: the set arrives but its parent workout does not, so the set
        // cannot link and must be skipped without consuming the cursor.
        await runSync()
        expect(await db.getFirstAsync('SELECT id FROM sets WHERE uuid = ?', 's-a')).toBeFalsy()

        // Cycle 2: the sets pull must NOT carry an updated_at cursor past the
        // skipped set — it has to be re-fetched.
        workoutPresent = true
        const callsBefore = fetchCalls.length
        await runSync()

        const secondCycleCalls = fetchCalls.slice(callsBefore)
        const setsPull = secondCycleCalls.find(
            (c) => c.method === 'GET' && c.url.includes('/sets?') && c.url.includes('deleted_at=is.null')
        )
        expect(setsPull).toBeDefined()
        expect(setsPull?.url).not.toContain('updated_at=gt')

        // With the workout now present, the re-fetched set links and persists.
        const set = await db.getFirstAsync<{ sync_status: string; workout_uuid: string; exercise_uuid: string }>(
            `SELECT s.sync_status, w.uuid AS workout_uuid, e.uuid AS exercise_uuid
             FROM sets s
             JOIN workouts w ON w.id = s.workout_id
             JOIN exercises e ON e.id = s.exercise_id
             WHERE s.uuid = ?`,
            's-a'
        )
        expect(set).toMatchObject({ sync_status: 'synced', workout_uuid: 'w-a', exercise_uuid: 'ex-a' })

        // Cycle 3: the set was upserted in cycle 2, so the cursor has advanced
        // and the sets pull is now filtered past it.
        const callsBeforeThird = fetchCalls.length
        await runSync()
        const thirdSetsPull = fetchCalls
            .slice(callsBeforeThird)
            .find((c) => c.method === 'GET' && c.url.includes('/sets?') && c.url.includes('deleted_at=is.null'))
        expect(thirdSetsPull?.url).toContain('updated_at=gt.2026-02-01T00%3A00%3A00Z')
    })
})

describe('runSync — expired access token is refreshed and retried', () => {
    it('refreshes once and retries a request that 401s with jwt expired, without raising the banner', async () => {
        refreshMock.mockImplementation(async () => {
            tokenState.current = 'fresh-token'
            return 'fresh-token'
        })

        let exercisesPullCount = 0
        mockFetch((call) => {
            if (isExercisesUpsertPull(call)) {
                exercisesPullCount += 1
                if (exercisesPullCount === 1) return { status: 401, body: { message: 'JWT expired' } }
            }
            return { body: [] }
        })

        const result = await runSync()

        expect(refreshMock).toHaveBeenCalledTimes(1)
        expect(result.failed).toBe(0)
        expect(syncStatusStore.get().kind).toBe('idle')
        // The 401 was retried, so the exercises upsert-pull was issued twice.
        expect(fetchCalls.filter(isExercisesUpsertPull).length).toBeGreaterThanOrEqual(2)
    })

    it('surfaces the failure when no fresh token is available to retry with', async () => {
        refreshMock.mockResolvedValue(null)
        mockFetch((call) => {
            if (isExercisesUpsertPull(call)) return { status: 401, body: { message: 'JWT expired' } }
            return { body: [] }
        })

        const result = await runSync()

        expect(refreshMock).toHaveBeenCalled()
        expect(result.failed).toBe(1)
        expect(syncStatusStore.get().kind).toBe('failed')
    })
})

describe('runSync — failure lifecycle (blocked / dead-letter)', () => {
    const respond = (status: number) =>
        mockFetch((call) => {
            // The push upsert is the only POST; fail it with the given status.
            if (call.method === 'POST') return { status, body: { message: 'nope' } }
            return { body: [] }
        })

    it('blocks a row on a permanent (4xx) rejection without raising the banner', async () => {
        await insertDirtyExercise('ex-bad')
        respond(422)

        await runSync()

        // Parked, not retried; excluded from the outbox.
        expect(await localStatus('ex-bad')).toBe('blocked')
        // The big failed banner must NOT show for a blocked-only cycle.
        expect(syncStatusStore.get().kind).toBe('idle')

        const state = await getSyncState()
        expect(state.blocked_size).toBe(1)
        expect(state.outbox_size).toBe(0)
    })

    it('keeps a transient (5xx) failure retryable and raises the banner', async () => {
        await insertDirtyExercise('ex-flaky')
        respond(500)

        await runSync()

        expect(await localStatus('ex-flaky')).toBe('failed')
        expect(syncStatusStore.get().kind).toBe('failed')
        expect((await getSyncState()).blocked_size).toBe(0)
    })

    it('un-parks blocked rows on retryBlockedRows so the next sync re-attempts them', async () => {
        await insertDirtyExercise('ex-bad')
        respond(422)
        await runSync()
        expect(await localStatus('ex-bad')).toBe('blocked')

        await retryBlockedRows()

        expect(await localStatus('ex-bad')).toBe('dirty')
        expect((await getSyncState()).blocked_size).toBe(0)
    })
})
