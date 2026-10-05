import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePrincipal } from '@/src/data/principal'
import { createTestDb, getTestDb, resetTestDb, type TestDb, useTestDb } from '@/src/test/setupTestDb'

vi.mock('@/src/db/client', () => ({
    getDb: async () => getTestDb(),
}))

vi.mock('@/src/data/remote/supabase/config', () => ({
    getSupabaseConfig: () => ({ url: 'https://example.test', publicKey: 'anon' }),
}))

const { refreshMock, tokenState, deleteLocalPhotoMock } = vi.hoisted(() => ({
    refreshMock: vi.fn(async () => null as string | null),
    tokenState: { current: 'token' },
    deleteLocalPhotoMock: vi.fn(async (_uri: string | null) => {}),
}))

vi.mock('@/src/data/remote/supabase/session', () => ({
    getSupabaseSession: () => ({ accessToken: tokenState.current, userId: 'user-1' }),
    refreshSupabaseAccessToken: () => refreshMock(),
}))

// The photo IO half lives on expo-file-system, which the node test
// environment cannot load; these tests cover the row pipeline only.
vi.mock('../photoStorage', () => ({
    backfillLocalPhotoKeys: async () => {},
    createExercisePhotoStore: () => ({ upload: async () => null, cleanup: async () => {} }),
    deleteLocalPhoto: (uri: string | null) => deleteLocalPhotoMock(uri),
    hydrateExercisePhotos: async () => 0,
}))

const {
    runSync,
    resetPullCursorsForTest,
    dropPullCursorCacheForTest,
    getSyncState,
    retryBlockedRows,
    hasLocalDataForActivePrincipal,
} = await import('../syncService')
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

type BodyCall = FetchCall & { body: unknown }
const bodyCalls: BodyCall[] = []

// Like mockFetch, but records request bodies and echoes upserts back as
// persisted so the Outbox acks them.
const mockFetchWithBodies = (pull: (call: FetchCall) => unknown[] | undefined = () => undefined) => {
    bodyCalls.length = 0
    let nextId = 1
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const u = typeof url === 'string' ? url : url.toString()
        const method = init?.method ?? 'GET'
        const body = init?.body ? JSON.parse(String(init.body)) : undefined
        bodyCalls.push({ url: u, method, body })
        if (method === 'POST') {
            const rows = body as { uuid: string }[]
            return new Response(JSON.stringify(rows.map((r) => ({ id: nextId++, uuid: r.uuid }))), { status: 201 })
        }
        if (method === 'PATCH') return new Response('', { status: 204 })
        return new Response(JSON.stringify(pull({ url: u, method }) ?? []), { status: 200 })
    }) as typeof fetch
}

beforeEach(async () => {
    await resetTestDb()
    db = await createTestDb()
    useTestDb(db)
    fetchCalls.length = 0
    await resetPullCursorsForTest()
    syncStatusStore.set({ kind: 'idle' })
    refreshMock.mockReset()
    refreshMock.mockResolvedValue(null)
    deleteLocalPhotoMock.mockClear()
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

describe('hasLocalDataForActivePrincipal — fresh-login hydration detection', () => {
    it('reports no data on an empty database', async () => {
        expect(await hasLocalDataForActivePrincipal()).toBe(false)
    })

    it('reports data once the active principal has a workout or exercise', async () => {
        await db.runAsync(
            `INSERT INTO workouts (uuid, user_id, date, sync_status) VALUES ('w-1', ?, '2026-06-01', 'synced')`,
            userId
        )
        expect(await hasLocalDataForActivePrincipal()).toBe(true)
    })

    it('ignores rows that belong to other principals, e.g. surviving guest data', async () => {
        await db.runAsync(
            `INSERT INTO workouts (uuid, user_id, date, sync_status) VALUES ('w-guest', 'someone-else', '2026-06-01', 'synced')`
        )
        await db.runAsync(
            `INSERT INTO exercises (uuid, user_id, name, type, sync_status) VALUES ('e-guest', NULL, 'Bench', 'weight', 'local')`
        )
        expect(await hasLocalDataForActivePrincipal()).toBe(false)
    })

    it('ignores soft-deleted rows', async () => {
        await db.runAsync(
            `INSERT INTO workouts (uuid, user_id, date, sync_status, deleted_at) VALUES ('w-del', ?, '2026-06-01', 'synced', '2026-06-02T00:00:00Z')`,
            userId
        )
        expect(await hasLocalDataForActivePrincipal()).toBe(false)
    })
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
                                photo_key: null,
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

    it('reloads the persisted cursor after a cold start so a restart pulls incrementally', async () => {
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
                                photo_key: null,
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

        // First cycle advances and persists the cursor to 2026-02-01.
        await runSync()

        // Simulate a process restart: the in-memory cache is gone but the
        // persisted watermark in SQLite survives.
        dropPullCursorCacheForTest()

        const callsBefore = fetchCalls.length
        const afterRestart = await runSync()
        expect(afterRestart.pulled).toBe(0)

        // The pull must still carry the persisted cursor rather than re-pulling
        // the whole dataset from scratch.
        const exercisesPull = fetchCalls
            .slice(callsBefore)
            .find((c) => c.url.includes('/exercises?') && c.url.includes('deleted_at=is.null'))
        expect(exercisesPull?.url).toContain('updated_at=gt.2026-02-01T00%3A00%3A00Z')
    })

    it('orders deletion pulls by deleted_at so a truncated response cannot advance the cursor past unseen rows', async () => {
        mockFetch(() => ({ body: [] }))

        await runSync()

        // The upsert pulls are cursor-safe under server-side truncation because
        // they are sorted ascending; the deletion pulls need the same guarantee.
        const deletionPulls = fetchCalls.filter((c) => c.method === 'GET' && c.url.includes('deleted_at=not.is.null'))
        expect(deletionPulls.length).toBe(4)
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
                                photo_key: null,
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
                            photo_key: null,
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

    it('does not re-insert a remote exercise that has a pending local deletion tombstone', async () => {
        // A merged-away duplicate: deleted locally with a tombstone that has not
        // pushed yet (here the push fails), so the server still returns it.
        await db.runAsync(
            `INSERT INTO deletion_tombstones (entity_type, entity_uuid, user_id, deleted_at, sync_status)
             VALUES ('exercise', 'ex-dup', ?, '2026-02-02T00:00:00Z', 'dirty')`,
            userId
        )
        mockFetch((call) => {
            if (call.method !== 'GET') return { ok: false, status: 500 }
            if (isExercisesUpsertPull(call)) {
                return {
                    body: [
                        {
                            uuid: 'ex-dup',
                            user_id: userId,
                            name: 'Bench',
                            type: 'weight',
                            muscle_group: 'chest',
                            photo_key: null,
                            position: 0,
                            created_at: '2026-02-01T00:00:00Z',
                            updated_at: '2026-02-01T00:00:00Z',
                            deleted_at: null,
                        },
                    ],
                }
            }
            return { body: [] }
        })

        await runSync()

        const row = await db.getFirstAsync<{ uuid: string }>('SELECT uuid FROM exercises WHERE uuid = ?', 'ex-dup')
        expect(row).toBeNull()
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
                            photo_key: null,
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
                            photo_key: null,
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

    it('freezes the sets cursor at the earliest held-back set even when later sets in the same batch link', async () => {
        // Two sets arrive in one batch ordered by updated_at: the earlier one's
        // workout is absent (held back), the later one's parents are present.
        // The batched write must still link the later set yet freeze the cursor
        // at the earlier held set so it is re-fetched next cycle.
        const setRow = (uuid: string, workoutUuid: string, updatedAt: string) => ({
            uuid,
            user_id: userId,
            weight: 100,
            reps: 5,
            distance: null,
            duration: null,
            rpe: 8,
            position: 0,
            sub_sets: null,
            created_at: updatedAt,
            updated_at: updatedAt,
            deleted_at: null,
            workouts: { uuid: workoutUuid },
            exercises: { uuid: 'ex-a' },
        })

        mockFetch((call) => {
            const isUpsertPull = call.method === 'GET' && call.url.includes('deleted_at=is.null')
            if (isUpsertPull && call.url.includes('updated_at=gt')) return { body: [] }
            if (isUpsertPull && call.url.includes('/exercises?')) {
                return {
                    body: [
                        {
                            uuid: 'ex-a',
                            user_id: userId,
                            name: 'Bench',
                            type: 'weight',
                            muscle_group: null,
                            photo_key: null,
                            position: 0,
                            created_at: '2026-02-01T00:00:00Z',
                            updated_at: '2026-02-01T00:00:00Z',
                            deleted_at: null,
                        },
                    ],
                }
            }
            if (isUpsertPull && call.url.includes('/workouts?')) {
                // Only w-present exists locally; w-missing never arrives.
                return {
                    body: [
                        {
                            uuid: 'w-present',
                            user_id: userId,
                            date: '2026-02-01',
                            start_time: null,
                            end_time: null,
                            status: 'finished',
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
                        setRow('s-early', 'w-missing', '2026-02-02T00:00:00Z'),
                        setRow('s-late', 'w-present', '2026-02-03T00:00:00Z'),
                    ],
                }
            }
            return { body: [] }
        })

        await runSync()

        // The later set linked despite sharing the batch with a held-back set.
        expect(await db.getFirstAsync('SELECT id FROM sets WHERE uuid = ?', 's-late')).toBeTruthy()
        expect(await db.getFirstAsync('SELECT id FROM sets WHERE uuid = ?', 's-early')).toBeFalsy()

        // The cursor froze at the earliest held set, so the next cycle re-pulls
        // without a watermark rather than skipping s-early forever.
        const callsBefore = fetchCalls.length
        await runSync()
        const setsPull = fetchCalls
            .slice(callsBefore)
            .find((c) => c.method === 'GET' && c.url.includes('/sets?') && c.url.includes('deleted_at=is.null'))
        expect(setsPull?.url).not.toContain('updated_at=gt')
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

describe('runSync — Workout Templates (ADR-0006)', () => {
    const templateRow = (uuid: string) =>
        db.getFirstAsync<{ name: string; exercise_uuids: string; sync_status: string }>(
            'SELECT name, exercise_uuids, sync_status FROM workout_templates WHERE uuid = ?',
            uuid
        )

    it('pushes a dirty Template with its membership as a real array, and a Workout with its template_uuid', async () => {
        await db.runAsync(
            `INSERT INTO workout_templates (uuid, user_id, name, exercise_uuids, sync_status, created_at, updated_at)
             VALUES ('t-1', ?, 'Push A', '["ex-1","ex-2"]', 'dirty', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
            userId
        )
        await db.runAsync(
            `INSERT INTO workouts (uuid, user_id, date, status, template_uuid, sync_status, created_at, updated_at)
             VALUES ('w-1', ?, '2026-01-02', 'finished', 't-1', 'dirty', '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z')`,
            userId
        )
        mockFetchWithBodies()

        const result = await runSync()

        expect(result).toMatchObject({ failed: 0, aborted: false })
        const templateUpsert = bodyCalls.find((c) => c.method === 'POST' && c.url.includes('/workout_templates?'))
        expect(templateUpsert?.body).toEqual([
            expect.objectContaining({ uuid: 't-1', user_id: userId, name: 'Push A', exercise_uuids: ['ex-1', 'ex-2'] }),
        ])
        const workoutUpsert = bodyCalls.find((c) => c.method === 'POST' && c.url.includes('/workouts?'))
        expect(workoutUpsert?.body).toEqual([expect.objectContaining({ uuid: 'w-1', template_uuid: 't-1' })])
        expect((await templateRow('t-1'))?.sync_status).toBe('synced')
    })

    it('pulls a remote Template and a Workout that references it', async () => {
        mockFetchWithBodies((call) => {
            const isUpsertPull = call.url.includes('deleted_at=is.null')
            if (isUpsertPull && call.url.includes('/workout_templates?')) {
                return [
                    {
                        uuid: 't-remote',
                        user_id: userId,
                        name: 'Legs',
                        exercise_uuids: ['ex-squat'],
                        position: 0,
                        created_at: '2026-03-01T00:00:00Z',
                        updated_at: '2026-03-01T00:00:00Z',
                        deleted_at: null,
                    },
                ]
            }
            if (isUpsertPull && call.url.includes('/workouts?')) {
                return [
                    {
                        uuid: 'w-remote',
                        user_id: userId,
                        date: '2026-03-02',
                        status: 'finished',
                        template_uuid: 't-remote',
                        created_at: '2026-03-02T00:00:00Z',
                        updated_at: '2026-03-02T00:00:00Z',
                        deleted_at: null,
                    },
                ]
            }
            return undefined
        })

        await runSync()

        expect(await templateRow('t-remote')).toEqual({
            name: 'Legs',
            exercise_uuids: '["ex-squat"]',
            sync_status: 'synced',
        })
        const workout = await db.getFirstAsync<{ template_uuid: string }>(
            `SELECT template_uuid FROM workouts WHERE uuid = 'w-remote'`
        )
        expect(workout?.template_uuid).toBe('t-remote')
    })

    it('applies a remote Template deletion locally', async () => {
        await db.runAsync(
            `INSERT INTO workout_templates (uuid, user_id, name, sync_status, updated_at)
             VALUES ('t-gone', ?, 'Old', 'synced', '2026-01-01T00:00:00Z')`,
            userId
        )
        mockFetchWithBodies((call) =>
            call.url.includes('/workout_templates?') && call.url.includes('deleted_at=not.is.null')
                ? [{ uuid: 't-gone', deleted_at: '2026-02-01T00:00:00Z' }]
                : undefined
        )

        await runSync()

        expect(await templateRow('t-gone')).toBeNull()
    })

    it('pushes a Template tombstone as a soft delete and never resurrects it from the live pull', async () => {
        await db.runAsync(
            `INSERT INTO deletion_tombstones (entity_type, entity_uuid, user_id, deleted_at, sync_status)
             VALUES ('workout_template', 't-del', ?, '2026-04-01T00:00:00Z', 'dirty')`,
            userId
        )
        mockFetchWithBodies((call) =>
            call.url.includes('/workout_templates?') && call.url.includes('deleted_at=is.null')
                ? [
                      {
                          uuid: 't-del',
                          user_id: userId,
                          name: 'Zombie',
                          exercise_uuids: [],
                          created_at: '2026-03-01T00:00:00Z',
                          updated_at: '2026-03-01T00:00:00Z',
                          deleted_at: null,
                      },
                  ]
                : undefined
        )

        await runSync()

        const patch = bodyCalls.find((c) => c.method === 'PATCH')
        expect(patch?.url).toContain('/workout_templates?uuid=eq.t-del')
        expect(patch?.body).toMatchObject({ deleted_at: '2026-04-01T00:00:00Z' })
        expect(await templateRow('t-del')).toBeNull()
    })

    it('omits a NULL template_uuid so an Unplanned or not-yet-linked copy never clears the server link', async () => {
        await db.runAsync(
            `INSERT INTO workouts (uuid, user_id, date, status, sync_status, created_at, updated_at)
             VALUES ('w-plain', ?, '2026-01-02', 'finished', 'dirty', '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z')`,
            userId
        )
        mockFetchWithBodies()

        await runSync()

        const workoutUpsert = bodyCalls.find((c) => c.method === 'POST' && c.url.includes('/workouts?'))
        const [row] = workoutUpsert?.body as Record<string, unknown>[]
        expect(row.uuid).toBe('w-plain')
        expect(row).not.toHaveProperty('template_uuid')
    })

    it('keeps pulling Workouts when the backend has no workout_templates table yet', async () => {
        bodyCalls.length = 0
        globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
            const u = typeof url === 'string' ? url : url.toString()
            if (u.includes('/workout_templates?')) {
                return new Response(JSON.stringify({ code: 'PGRST205', message: 'Could not find the table' }), {
                    status: 404,
                })
            }
            if (u.includes('/workouts?') && u.includes('deleted_at=is.null')) {
                return new Response(
                    JSON.stringify([
                        {
                            uuid: 'w-old-backend',
                            user_id: userId,
                            date: '2026-03-02',
                            status: 'finished',
                            created_at: '2026-03-02T00:00:00Z',
                            updated_at: '2026-03-02T00:00:00Z',
                            deleted_at: null,
                        },
                    ]),
                    { status: 200 }
                )
            }
            return new Response('[]', { status: 200 })
        }) as typeof fetch

        const result = await runSync()

        expect(result).toMatchObject({ failed: 0, aborted: false })
        const workout = await db.getFirstAsync<{ template_uuid: string | null }>(
            `SELECT template_uuid FROM workouts WHERE uuid = 'w-old-backend'`
        )
        expect(workout).toEqual({ template_uuid: null })
    })

    it('un-parks a blocked Template on retryBlockedRows', async () => {
        await db.runAsync(
            `INSERT INTO workout_templates (uuid, user_id, name, sync_status, sync_attempts)
             VALUES ('t-blocked', ?, 'X', 'blocked', 5)`,
            userId
        )

        await retryBlockedRows()

        const row = await db.getFirstAsync<{ sync_status: string; sync_attempts: number }>(
            `SELECT sync_status, sync_attempts FROM workout_templates WHERE uuid = 't-blocked'`
        )
        expect(row).toEqual({ sync_status: 'dirty', sync_attempts: 0 })
    })

    it('pushes Exercise taxonomy fields with secondary Muscles as a real array (ADR-0007)', async () => {
        await db.runAsync(
            `INSERT INTO exercises (uuid, user_id, name, type, muscle_group, primary_muscle, secondary_muscles, equipment,
                                    sync_status, created_at, updated_at)
             VALUES ('ex-tax', ?, 'Bench', 'weight', 'chest', 'chest', '["triceps"]', 'barbell', 'dirty',
                     '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
            userId
        )
        mockFetchWithBodies()

        await runSync()

        const upsert = bodyCalls.find((c) => c.method === 'POST' && c.url.includes('/exercises?'))
        expect(upsert?.body).toEqual([
            expect.objectContaining({
                uuid: 'ex-tax',
                muscle_group: 'chest',
                primary_muscle: 'chest',
                secondary_muscles: ['triceps'],
                equipment: 'barbell',
            }),
        ])
    })

    it('pulls Exercise taxonomy fields into the local columns', async () => {
        mockFetchWithBodies((call) =>
            call.url.includes('/exercises?') && call.url.includes('deleted_at=is.null')
                ? [
                      {
                          uuid: 'ex-remote-tax',
                          user_id: userId,
                          name: 'Squat',
                          type: 'weight',
                          muscle_group: 'legs',
                          primary_muscle: 'quads',
                          secondary_muscles: ['glutes'],
                          equipment: 'barbell',
                          position: 0,
                          created_at: '2026-03-01T00:00:00Z',
                          updated_at: '2026-03-01T00:00:00Z',
                          deleted_at: null,
                      },
                  ]
                : undefined
        )

        await runSync()

        const row = await db.getFirstAsync<Record<string, unknown>>(
            `SELECT primary_muscle, secondary_muscles, equipment FROM exercises WHERE uuid = 'ex-remote-tax'`
        )
        expect(row).toEqual({ primary_muscle: 'quads', secondary_muscles: '["glutes"]', equipment: 'barbell' })
    })

    it('round-trips Exercise taxonomy keys this client does not know instead of erasing them', async () => {
        mockFetchWithBodies((call) =>
            call.url.includes('/exercises?') && call.url.includes('deleted_at=is.null')
                ? [
                      {
                          uuid: 'ex-future',
                          user_id: userId,
                          name: 'Neck curl',
                          type: 'weight',
                          muscle_group: 'neck',
                          primary_muscle: 'neck_flexors',
                          secondary_muscles: ['traps_upper'],
                          equipment: 'neck_harness',
                          position: 0,
                          created_at: '2026-03-01T00:00:00Z',
                          updated_at: '2026-03-01T00:00:00Z',
                          deleted_at: null,
                      },
                  ]
                : undefined
        )
        await runSync()

        // A local edit (here a reorder) re-queues the whole row for push.
        await db.runAsync(
            `UPDATE exercises SET position = 3, sync_status = 'dirty', updated_at = '2026-04-01T00:00:00Z'
             WHERE uuid = 'ex-future'`
        )
        mockFetchWithBodies()
        await runSync()

        const upsert = bodyCalls.find((c) => c.method === 'POST' && c.url.includes('/exercises?'))
        expect(upsert?.body).toEqual([
            expect.objectContaining({
                uuid: 'ex-future',
                primary_muscle: 'neck_flexors',
                secondary_muscles: ['traps_upper'],
                equipment: 'neck_harness',
            }),
        ])
    })

    it('counts a dirty Template in the outbox size', async () => {
        await db.runAsync(
            `INSERT INTO workout_templates (uuid, user_id, name, sync_status) VALUES ('t-out', ?, 'X', 'dirty')`,
            userId
        )
        expect((await getSyncState()).outbox_size).toBe(1)
    })
})

describe('runSync — Exercises are soft-deleted, their Sets kept (issue #85)', () => {
    const remoteExercise = (uuid: string, overrides: Record<string, unknown> = {}) => ({
        uuid,
        user_id: userId,
        name: 'Bench',
        type: 'weight',
        muscle_group: 'chest',
        photo_key: null,
        position: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        deleted_at: null,
        ...overrides,
    })

    const remoteWorkout = (uuid: string) => ({
        uuid,
        user_id: userId,
        date: '2026-01-02',
        status: 'finished',
        created_at: '2026-01-02T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        deleted_at: null,
    })

    const remoteSet = (
        uuid: string,
        workoutUuid: string,
        exerciseUuid: string,
        overrides: { updated_at?: string; workoutDeletedAt?: string } = {}
    ) => ({
        uuid,
        user_id: userId,
        weight: 80,
        reps: 8,
        distance: null,
        duration: null,
        rpe: null,
        position: 0,
        sub_sets: null,
        created_at: '2026-01-02T00:00:00Z',
        updated_at: overrides.updated_at ?? '2026-01-02T00:00:00Z',
        deleted_at: null,
        workouts: { uuid: workoutUuid, deleted_at: overrides.workoutDeletedAt ?? null },
        exercises: { uuid: exerciseUuid },
    })

    const isLivePull = (call: FetchCall, table: string) =>
        call.url.includes(`/${table}?`) && call.url.includes('deleted_at=is.null')
    const isFirstLivePull = (call: FetchCall, table: string) =>
        isLivePull(call, table) && !call.url.includes('updated_at=gt')
    const isFirstDeletionPull = (call: FetchCall, table: string) =>
        call.url.includes(`/${table}?`) && call.url.includes('deleted_at=not.is.null')

    const exerciseRow = (uuid: string) =>
        db.getFirstAsync<{
            name: string
            deleted_at: string | null
            sync_status: string
            photo_uri: string | null
            photo_key: string | null
        }>('SELECT name, deleted_at, sync_status, photo_uri, photo_key FROM exercises WHERE uuid = ?', uuid)

    const linkedSet = (uuid: string) =>
        db.getFirstAsync<{ exercise_uuid: string; workout_uuid: string; sync_status: string }>(
            `SELECT e.uuid AS exercise_uuid, w.uuid AS workout_uuid, s.sync_status
             FROM sets s JOIN exercises e ON e.id = s.exercise_id JOIN workouts w ON w.id = s.workout_id
             WHERE s.uuid = ?`,
            uuid
        )

    // A synced Exercise with one synced Set in a synced Workout.
    const seedHistory = async (exerciseUuid: string, photoUri: string | null = null) => {
        const exercise = await db.runAsync(
            `INSERT INTO exercises (uuid, user_id, name, type, photo_uri, sync_status, created_at, updated_at)
             VALUES (?, ?, 'Bench', 'weight', ?, 'synced', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
            exerciseUuid,
            userId,
            photoUri
        )
        const workout = await db.runAsync(
            `INSERT INTO workouts (uuid, user_id, date, status, sync_status, created_at, updated_at)
             VALUES ('w-1', ?, '2026-01-02', 'finished', 'synced', '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z')`,
            userId
        )
        await db.runAsync(
            `INSERT INTO sets (uuid, user_id, workout_id, exercise_id, weight, reps, sync_status, created_at, updated_at)
             VALUES ('s-1', ?, ?, ?, 80, 8, 'synced', '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z')`,
            userId,
            workout.lastInsertRowId,
            exercise.lastInsertRowId
        )
    }

    // An Exercise deleted on this device at `deletedAt`, with its tombstone.
    const seedLocalDeletion = async (uuid: string, deletedAt: string, tombstoneStatus: 'dirty' | 'synced') => {
        await db.runAsync(
            `INSERT INTO exercises (uuid, user_id, name, type, sync_status, created_at, updated_at, deleted_at)
             VALUES (?, ?, 'Bench', 'weight', 'synced', '2026-01-01T00:00:00Z', ?, ?)`,
            uuid,
            userId,
            deletedAt,
            deletedAt
        )
        await db.runAsync(
            `INSERT INTO deletion_tombstones (entity_type, entity_uuid, user_id, deleted_at, sync_status)
             VALUES ('exercise', ?, ?, ?, ?)`,
            uuid,
            userId,
            deletedAt,
            tombstoneStatus
        )
    }

    it('applies a remote Exercise deletion as a soft delete and keeps its Sets', async () => {
        await seedHistory('ex-gone', 'file:///doc/exercises/1.jpg')
        mockFetchWithBodies((call) =>
            isFirstDeletionPull(call, 'exercises')
                ? [
                      remoteExercise('ex-gone', {
                          updated_at: '2026-02-01T00:00:00Z',
                          deleted_at: '2026-02-01T00:00:00Z',
                      }),
                  ]
                : undefined
        )

        await runSync()

        expect(await exerciseRow('ex-gone')).toMatchObject({
            deleted_at: '2026-02-01T00:00:00Z',
            sync_status: 'synced',
            photo_uri: null,
        })
        expect(await linkedSet('s-1')).toMatchObject({ exercise_uuid: 'ex-gone', sync_status: 'synced' })
        // The local photo file still goes with the Exercise.
        expect(deleteLocalPhotoMock).toHaveBeenCalledWith('file:///doc/exercises/1.jpg')
    })

    it('keeps an unsynced local edit newer than the remote deletion (last-writer-wins)', async () => {
        await db.runAsync(
            `INSERT INTO exercises (uuid, user_id, name, type, sync_status, created_at, updated_at)
             VALUES ('ex-edited', ?, 'Edited', 'weight', 'dirty', '2026-01-01T00:00:00Z', '2026-03-01T00:00:00Z')`,
            userId
        )
        // The push fails, so the edit is still unsynced when the deletion arrives.
        mockFetch((call) => {
            if (call.method !== 'GET') return { status: 500 }
            if (isFirstDeletionPull(call, 'exercises')) {
                return {
                    body: [
                        remoteExercise('ex-edited', {
                            updated_at: '2026-02-01T00:00:00Z',
                            deleted_at: '2026-02-01T00:00:00Z',
                        }),
                    ],
                }
            }
            return { body: [] }
        })

        await runSync()

        expect(await exerciseRow('ex-edited')).toMatchObject({ name: 'Edited', deleted_at: null })
        expect(await localStatus('ex-edited')).toBe('failed')
    })

    it('leaves an Exercise already deleted here as it is when its deletion comes back', async () => {
        await seedLocalDeletion('ex-mine', '2026-04-01T00:00:00Z', 'synced')
        mockFetchWithBodies((call) =>
            isFirstDeletionPull(call, 'exercises')
                ? [
                      remoteExercise('ex-mine', {
                          updated_at: '2026-04-02T00:00:00Z',
                          deleted_at: '2026-04-02T00:00:00Z',
                      }),
                  ]
                : undefined
        )

        await runSync()

        expect((await exerciseRow('ex-mine'))?.deleted_at).toBe('2026-04-01T00:00:00Z')
        expect(deleteLocalPhotoMock).not.toHaveBeenCalled()
    })

    it('inserts a remotely deleted Exercise this device lacks, so its held-back Set links and the cursor moves on', async () => {
        mockFetchWithBodies((call) => {
            if (isFirstLivePull(call, 'workouts')) return [remoteWorkout('w-a')]
            if (isFirstLivePull(call, 'sets')) return [remoteSet('s-a', 'w-a', 'ex-gone')]
            if (isFirstDeletionPull(call, 'exercises')) {
                return [
                    remoteExercise('ex-gone', {
                        name: 'Old Bench',
                        photo_key: 'ex-gone-1.jpg',
                        updated_at: '2026-02-01T00:00:00Z',
                        deleted_at: '2026-02-01T00:00:00Z',
                    }),
                ]
            }
            return undefined
        })

        await runSync()

        // A deleted row without a photo: its bytes are gone with the Exercise.
        expect(await exerciseRow('ex-gone')).toEqual({
            name: 'Old Bench',
            deleted_at: '2026-02-01T00:00:00Z',
            sync_status: 'synced',
            photo_uri: null,
            photo_key: null,
        })
        expect(await linkedSet('s-a')).toEqual({ exercise_uuid: 'ex-gone', workout_uuid: 'w-a', sync_status: 'synced' })

        await runSync()
        const setsPull = bodyCalls.filter((c) => c.method === 'GET' && isLivePull(c, 'sets')).at(-1)
        expect(setsPull?.url).toContain('updated_at=gt.2026-01-02T00%3A00%3A00Z')
    })

    it('does not resurrect a locally deleted Exercise from the live pull while its tombstone is pending', async () => {
        await seedLocalDeletion('ex-del', '2026-04-01T00:00:00Z', 'dirty')
        mockFetch((call) => {
            // The tombstone push fails, so the server still has the row live.
            if (call.method !== 'GET') return { status: 500 }
            if (isLivePull(call, 'exercises')) {
                return { body: [remoteExercise('ex-del', { updated_at: '2026-05-01T00:00:00Z' })] }
            }
            return { body: [] }
        })

        await runSync()

        expect((await exerciseRow('ex-del'))?.deleted_at).toBe('2026-04-01T00:00:00Z')
    })

    it('keeps a pushed deletion against an older live copy, but lets a newer remote edit win', async () => {
        await seedLocalDeletion('ex-older', '2026-04-01T00:00:00Z', 'synced')
        await seedLocalDeletion('ex-newer', '2026-04-01T00:00:00Z', 'synced')
        mockFetchWithBodies((call) =>
            isLivePull(call, 'exercises')
                ? [
                      remoteExercise('ex-older', { updated_at: '2026-03-01T00:00:00Z' }),
                      // e.g. an older app version un-deleted it with a later edit
                      remoteExercise('ex-newer', { name: 'Edited', updated_at: '2026-05-01T00:00:00Z' }),
                  ]
                : undefined
        )

        await runSync()

        expect((await exerciseRow('ex-older'))?.deleted_at).toBe('2026-04-01T00:00:00Z')
        expect(await exerciseRow('ex-newer')).toMatchObject({ name: 'Edited', deleted_at: null })
    })

    it('pushes an unpushed deleted Exercise as deleted, so its Sets still get a remote parent', async () => {
        await db.runAsync(
            `INSERT INTO exercises (uuid, user_id, name, type, sync_status, created_at, updated_at, deleted_at)
             VALUES ('ex-new', ?, 'Bench', 'weight', 'dirty', '2026-01-01T00:00:00Z', '2026-01-03T00:00:00Z', '2026-01-03T00:00:00Z')`,
            userId
        )
        const exercise = await db.getFirstAsync<{ id: number }>(`SELECT id FROM exercises WHERE uuid = 'ex-new'`)
        const workout = await db.runAsync(
            `INSERT INTO workouts (uuid, user_id, date, status, sync_status, created_at, updated_at)
             VALUES ('w-new', ?, '2026-01-02', 'finished', 'dirty', '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z')`,
            userId
        )
        await db.runAsync(
            `INSERT INTO sets (uuid, user_id, workout_id, exercise_id, reps, sync_status, created_at, updated_at)
             VALUES ('s-new', ?, ?, ?, 5, 'dirty', '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z')`,
            userId,
            workout.lastInsertRowId,
            exercise?.id
        )
        mockFetchWithBodies()

        const result = await runSync()

        expect(result).toMatchObject({ failed: 0, aborted: false })
        const exerciseUpsert = bodyCalls.find((c) => c.method === 'POST' && c.url.includes('/exercises?'))
        expect(exerciseUpsert?.body).toEqual([
            expect.objectContaining({ uuid: 'ex-new', deleted_at: '2026-01-03T00:00:00Z' }),
        ])
        expect(bodyCalls.some((c) => c.method === 'POST' && c.url.includes('/sets?'))).toBe(true)
        expect((await linkedSet('s-new'))?.sync_status).toBe('synced')
    })
})
