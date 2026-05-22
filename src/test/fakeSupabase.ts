/**
 * Fake Supabase adapter for tests.
 *
 * Models the surface the current sync engine calls against the PostgREST API:
 *   - upsert(table, rows)              POST    ?on_conflict=uuid (resolution=merge-duplicates)
 *   - selectByUuid(table, uuid)        GET     ?select=id&uuid=eq.<uuid>
 *   - selectActive(table, userId)      GET     ?user_id=eq.<id>&deleted_at=is.null
 *   - selectDeleted(table, userId)     GET     ?user_id=eq.<id>&deleted_at=not.is.null
 *   - patchByUuid(table, uuid, ...)    PATCH   ?uuid=eq.<uuid>&user_id=eq.<id>
 *
 * Per-call failure injection covers the three modes the PRD calls out:
 *   - 'network-error'        — request throws (transient network failure)
 *   - 'empty-after-upsert'   — upsert "succeeds" but the returned row list is empty
 *                              (the silent rejection mode the PRD explicitly names)
 *   - 'success' (default)    — normal behavior
 */

export type RemoteTable = 'exercises' | 'workouts' | 'sets'

export type RemoteRow = Record<string, unknown> & {
    uuid: string
    user_id: string | null
    deleted_at?: string | null
    updated_at?: string | null
}

export type FailureMode =
    | { kind: 'network-error'; message?: string }
    | { kind: 'empty-after-upsert' }

export type UpsertResult = { id: number; uuid: string }[]

export type CallCounts = Record<
    'upsert' | 'selectByUuid' | 'selectIdsByUuids' | 'selectActive' | 'selectDeleted' | 'patchByUuid',
    Record<RemoteTable, number>
>

export interface FakeSupabaseAdapter {
    upsert(table: RemoteTable, rows: RemoteRow[]): Promise<UpsertResult>
    selectByUuid(table: RemoteTable, uuid: string): Promise<{ id: number } | null>
    selectIdsByUuids(table: RemoteTable, uuids: string[]): Promise<{ id: number; uuid: string }[]>
    selectActive(table: RemoteTable, userId: string): Promise<RemoteRow[]>
    selectDeleted(table: RemoteTable, userId: string): Promise<{ uuid: string; deleted_at: string | null }[]>
    patchByUuid(
        table: RemoteTable,
        uuid: string,
        userId: string,
        patch: Partial<RemoteRow>
    ): Promise<void>

    /** Queue a failure to be consumed by the next call (FIFO). */
    queueFailure(failure: FailureMode): void

    /** Test introspection: all rows currently "in" the remote, by table. */
    snapshot(table: RemoteTable): RemoteRow[]

    /** Test introspection: count of each method invocation, per table. */
    callCounts(): CallCounts
}

export const createFakeSupabaseAdapter = (): FakeSupabaseAdapter => {
    const tables: Record<RemoteTable, Map<string, RemoteRow>> = {
        exercises: new Map(),
        workouts: new Map(),
        sets: new Map(),
    }
    const idsByUuid: Record<RemoteTable, Map<string, number>> = {
        exercises: new Map(),
        workouts: new Map(),
        sets: new Map(),
    }
    const nextId: Record<RemoteTable, number> = { exercises: 1, workouts: 1, sets: 1 }
    const failureQueue: FailureMode[] = []
    const counts: CallCounts = {
        upsert: { exercises: 0, workouts: 0, sets: 0 },
        selectByUuid: { exercises: 0, workouts: 0, sets: 0 },
        selectIdsByUuids: { exercises: 0, workouts: 0, sets: 0 },
        selectActive: { exercises: 0, workouts: 0, sets: 0 },
        selectDeleted: { exercises: 0, workouts: 0, sets: 0 },
        patchByUuid: { exercises: 0, workouts: 0, sets: 0 },
    }

    const takeFailure = () => failureQueue.shift()

    const assignId = (table: RemoteTable, uuid: string) => {
        const existing = idsByUuid[table].get(uuid)
        if (existing !== undefined) return existing
        const id = nextId[table]++
        idsByUuid[table].set(uuid, id)
        return id
    }

    return {
        async upsert(table, rows) {
            counts.upsert[table] += 1
            const failure = takeFailure()
            if (failure?.kind === 'network-error') {
                throw new Error(failure.message ?? 'network error')
            }
            if (failure?.kind === 'empty-after-upsert') {
                // Silently accept-but-return-nothing: the dangerous mode the PRD calls out.
                return []
            }
            const result: UpsertResult = []
            for (const row of rows) {
                tables[table].set(row.uuid, { ...row })
                result.push({ id: assignId(table, row.uuid), uuid: row.uuid })
            }
            return result
        },

        async selectByUuid(table, uuid) {
            counts.selectByUuid[table] += 1
            const failure = takeFailure()
            if (failure?.kind === 'network-error') {
                throw new Error(failure.message ?? 'network error')
            }
            const id = idsByUuid[table].get(uuid)
            return id === undefined ? null : { id }
        },

        async selectIdsByUuids(table, uuids) {
            counts.selectIdsByUuids[table] += 1
            const failure = takeFailure()
            if (failure?.kind === 'network-error') {
                throw new Error(failure.message ?? 'network error')
            }
            const result: { id: number; uuid: string }[] = []
            for (const uuid of uuids) {
                const id = idsByUuid[table].get(uuid)
                if (id !== undefined) result.push({ id, uuid })
            }
            return result
        },

        async selectActive(table, userId) {
            counts.selectActive[table] += 1
            const failure = takeFailure()
            if (failure?.kind === 'network-error') {
                throw new Error(failure.message ?? 'network error')
            }
            return [...tables[table].values()].filter(
                (row) => row.user_id === userId && !row.deleted_at
            )
        },

        async selectDeleted(table, userId) {
            counts.selectDeleted[table] += 1
            const failure = takeFailure()
            if (failure?.kind === 'network-error') {
                throw new Error(failure.message ?? 'network error')
            }
            return [...tables[table].values()]
                .filter((row) => row.user_id === userId && row.deleted_at)
                .map((row) => ({ uuid: row.uuid, deleted_at: row.deleted_at ?? null }))
        },

        async patchByUuid(table, uuid, userId, patch) {
            counts.patchByUuid[table] += 1
            const failure = takeFailure()
            if (failure?.kind === 'network-error') {
                throw new Error(failure.message ?? 'network error')
            }
            const existing = tables[table].get(uuid)
            if (!existing || existing.user_id !== userId) return
            tables[table].set(uuid, { ...existing, ...patch })
        },

        queueFailure(failure) {
            failureQueue.push(failure)
        },

        snapshot(table) {
            return [...tables[table].values()]
        },

        callCounts() {
            return counts
        },
    }
}
