import { invalidateExercisesCache } from '@/src/data/exercisesCache'
import { onPrincipalChange } from '@/src/data/principal'
import { getSupabaseConfig } from '@/src/data/remote/supabase/config'
import { getSupabaseSession, refreshSupabaseAccessToken } from '@/src/data/remote/supabase/session'
import { getDb } from '@/src/db/client'
import { nowIso } from '@/src/db/sync'
import { executeWriteTransaction } from '@/src/db/writeQueue'
import { isRemoteDataMode } from '@/src/modules/auth/authMode'
import { createOutbox, DIRTY_STATUSES } from './Outbox'
import { capturePrincipalSnapshot, type LivePrincipal } from './PrincipalSnapshot'
import { makePushFn, preloadSetParents } from './PushPipeline'
import type { RemoteAdapter } from './RemoteAdapter'
import { RemoteRequestError } from './RemoteAdapter'
import { createRemoteIdResolver } from './RemoteIdResolver'
import { createRemoteWriter } from './RemoteWriter'
import {
    parseIsoMillis,
    shouldSkipRemoteRow,
    toExerciseColumns,
    toSetColumns,
    toWorkoutColumns,
} from './remoteRowReconcile'
import { type CycleResult, drainOutbox } from './SyncCycle'
import { type SyncFailure, syncStatusStore } from './SyncStatus'

type SyncState = {
    is_syncing: number
    outbox_size: number
    last_success_at: string | null
    last_attempt_at: string | null
    last_error: string | null
    // Rows given up on (parked as 'blocked'). Surfaced as a quiet "couldn't
    // sync" indicator, separate from the transient-failure banner. Derived at
    // read time, not stored in the sync_state row.
    blocked_size: number
}

type DeletedRow = {
    uuid: string
    deleted_at: string | null
}

type RemoteSetWithRefs = {
    uuid: string
    user_id: string
    weight: number | null
    reps: number | null
    distance: number | null
    duration: number | null
    rpe: number | null
    position: number
    sub_sets: string | null
    created_at: string | null
    updated_at: string | null
    deleted_at: string | null
    workouts: { uuid: string } | { uuid: string }[] | null
    exercises: { uuid: string } | { uuid: string }[] | null
}

type RemoteSimpleRow = {
    uuid: string
    user_id: string | null
    name?: string
    type?: string
    muscle_group?: string | null
    photo_uri?: string | null
    position?: number
    date?: string
    start_time?: string | null
    end_time?: string | null
    status?: 'in_progress' | 'finished'
    note?: string | null
    created_at: string | null
    updated_at: string | null
    deleted_at: string | null
}

export type SyncCycleResult = {
    skipped: boolean
    pushed: number
    pulled: number
    failed: number
    aborted: boolean
}

const IDLE_RESULT: SyncCycleResult = {
    skipped: true,
    pushed: 0,
    pulled: 0,
    failed: 0,
    aborted: false,
}

let currentRun: Promise<SyncCycleResult> | null = null

const shouldUseRemoteSync = () => isRemoteDataMode()

const buildQuery = (params: Record<string, string | undefined>) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.set(key, value)
    })
    return query.toString()
}

const request = async <T>(
    table: string,
    options?: {
        method?: 'GET' | 'POST' | 'PATCH'
        query?: Record<string, string | undefined>
        body?: unknown
        prefer?: string
    }
): Promise<T> => {
    const config = getSupabaseConfig()
    const session = getSupabaseSession()
    if (!config || !session?.accessToken || !session.userId) {
        throw new Error('Remote sync requested without authenticated session.')
    }

    const query = options?.query ? buildQuery(options.query) : ''
    const url = `${config.url}/rest/v1/${table}${query ? `?${query}` : ''}`

    const send = async (accessToken: string): Promise<{ response: Response; text: string }> => {
        const response = await fetch(url, {
            method: options?.method ?? 'GET',
            headers: {
                apikey: config.publicKey,
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                ...(options?.prefer ? { Prefer: options.prefer } : {}),
            },
            body: options?.body ? JSON.stringify(options.body) : undefined,
        })
        return { response, text: await response.text() }
    }

    let { response, text } = await send(session.accessToken)

    // An expired access token is recoverable: the auth layer holds a refresh
    // token. Refresh once and retry before treating this as a sync failure, so
    // a token that lapses while the app is backgrounded doesn't flash a
    // spurious "sync failed" banner on the next foreground cycle.
    if (response.status === 401 && text.toLowerCase().includes('jwt expired')) {
        const refreshedToken = await refreshSupabaseAccessToken()
        if (refreshedToken) {
            ;({ response, text } = await send(refreshedToken))
        }
    }

    const payload = text ? (JSON.parse(text) as T) : (null as T)
    if (!response.ok) {
        const normalized = text.toLowerCase()
        if (response.status === 401 && normalized.includes('jwt expired')) {
            throw new RemoteRequestError('Sync auth expired. Please sign in again.', 401)
        }
        throw new RemoteRequestError(
            `Sync request failed (${table}): ${response.status} ${response.statusText} ${text}`,
            response.status
        )
    }
    return payload
}

const countRowsByStatus = async (statusClause: string, userId?: string) => {
    const db = await getDb()
    const shouldScopeByUser = shouldUseRemoteSync() && !!userId
    const userScopeClause = shouldScopeByUser ? 'AND user_id = ?' : ''
    const userScopeParams = shouldScopeByUser ? [userId as string] : []
    const tables = ['exercises', 'workouts', 'sets', 'deletion_tombstones'] as const
    const counts = await Promise.all(
        tables.map((table) =>
            db.getFirstAsync<{ count: number }>(
                `SELECT COUNT(*) as count FROM ${table} WHERE sync_status ${statusClause} ${userScopeClause}`,
                ...userScopeParams
            )
        )
    )
    return counts.reduce((sum, row) => sum + (row?.count ?? 0), 0)
}

// Rows awaiting a push attempt (dirty or retryable-failed).
const getOutboxSize = (userId?: string) => countRowsByStatus(`IN ${DIRTY_STATUSES}`, userId)

// Rows given up on after repeated/permanent failure.
const getBlockedSize = (userId?: string) => countRowsByStatus(`= 'blocked'`, userId)

const updateSyncState = async (partial: Partial<SyncState>) => {
    const updates: string[] = []
    const values: (string | number | null)[] = []
    if (partial.is_syncing !== undefined) {
        updates.push('is_syncing = ?')
        values.push(partial.is_syncing)
    }
    if (partial.outbox_size !== undefined) {
        updates.push('outbox_size = ?')
        values.push(partial.outbox_size)
    }
    if (partial.last_success_at !== undefined) {
        updates.push('last_success_at = ?')
        values.push(partial.last_success_at)
    }
    if (partial.last_attempt_at !== undefined) {
        updates.push('last_attempt_at = ?')
        values.push(partial.last_attempt_at)
    }
    if (partial.last_error !== undefined) {
        updates.push('last_error = ?')
        values.push(partial.last_error)
    }
    if (updates.length === 0) return

    await executeWriteTransaction((db) =>
        db.runAsync(`UPDATE sync_state SET ${updates.join(', ')} WHERE id = 1`, ...values)
    )
}

const createSupabaseHttpAdapter = (): RemoteAdapter => ({
    async upsert(table, rows) {
        if (rows.length === 0) return []
        const response = await request<{ id: number; uuid: string }[] | null>(table, {
            method: 'POST',
            query: { on_conflict: 'uuid', select: 'id,uuid' },
            prefer: 'resolution=merge-duplicates,return=representation',
            body: rows,
        })
        return response ?? []
    },

    async selectIdsByUuids(table, uuids) {
        if (uuids.length === 0) return []
        const response = await request<{ id: number; uuid: string }[]>(table, {
            query: { select: 'id,uuid', uuid: `in.(${uuids.join(',')})` },
        })
        return response ?? []
    },

    async patchByUuid(table, uuid, userId, patch) {
        await request<unknown>(table, {
            method: 'PATCH',
            query: { uuid: `eq.${uuid}`, user_id: `eq.${userId}` },
            body: patch,
        })
    },
})

// In-memory pull cursors per userId. Tracks the max updated_at / deleted_at we
// have seen so subsequent pulls can request only rows that have advanced past
// it. Cold-start (process restart) falls back to a full pull, which is
// acceptable: the scheduler only relies on the cursor for cheap-exit detection
// of idle cycles, not for correctness.
type PullCursors = {
    exercisesUpdated: string | null
    exercisesDeleted: string | null
    workoutsUpdated: string | null
    workoutsDeleted: string | null
    setsUpdated: string | null
    setsDeleted: string | null
}

const EMPTY_CURSORS: PullCursors = {
    exercisesUpdated: null,
    exercisesDeleted: null,
    workoutsUpdated: null,
    workoutsDeleted: null,
    setsUpdated: null,
    setsDeleted: null,
}

const pullCursorsByUser = new Map<string, PullCursors>()

const getCursors = (userId: string): PullCursors => pullCursorsByUser.get(userId) ?? { ...EMPTY_CURSORS }

const setCursors = (userId: string, cursors: PullCursors) => {
    pullCursorsByUser.set(userId, cursors)
}

const resetPullCursors = () => {
    pullCursorsByUser.clear()
}

export const resetPullCursorsForTest = resetPullCursors

// Pull cursors are an in-memory incremental watermark per user. A principal
// transition (sign-in, sign-out, guest <-> account) means we're now syncing a
// different scope — or local data was cleared underneath us — so the old
// watermarks must not carry over, otherwise the next pull would skip rows.
onPrincipalChange(() => {
    resetPullCursors()
})

const maxIso = (a: string | null, b: string | null | undefined) => {
    if (!a) return b ?? null
    if (!b) return a
    return parseIsoMillis(a) >= parseIsoMillis(b) ? a : b
}

// Apply remotely-deleted rows to the local table, skipping any row whose local
// copy is dirty and newer (local wins). Returns the advanced deletion cursor.
// Shared by the per-entity pulls, which differ only by table name.
const applyRemoteDeletions = async (
    table: string,
    deleted: DeletedRow[],
    initialCursor: string | null
): Promise<string | null> => {
    let nextDeleted: string | null = initialCursor
    for (const row of deleted) {
        await executeWriteTransaction(async (db) => {
            const local = await db.getFirstAsync<{ updated_at: string | null; sync_status: string | null }>(
                `SELECT updated_at, sync_status FROM ${table} WHERE uuid = ? LIMIT 1`,
                row.uuid
            )
            if (!local) return
            const localIsDirty = local.sync_status === 'dirty' || local.sync_status === 'failed'
            if (localIsDirty && parseIsoMillis(local.updated_at) > parseIsoMillis(row.deleted_at)) return
            await db.runAsync(`DELETE FROM ${table} WHERE uuid = ?`, row.uuid)
        })
        nextDeleted = maxIso(nextDeleted, row.deleted_at)
    }
    return nextDeleted
}

const pullExercises = async (userId: string): Promise<number> => {
    const cursors = getCursors(userId)
    const remote = await request<RemoteSimpleRow[]>('exercises', {
        query: {
            select: '*',
            user_id: `eq.${userId}`,
            deleted_at: 'is.null',
            order: 'updated_at.asc',
            ...(cursors.exercisesUpdated ? { updated_at: `gt.${cursors.exercisesUpdated}` } : {}),
        },
    })

    let nextUpdated = cursors.exercisesUpdated
    for (const row of remote) {
        await executeWriteTransaction(async (innerDb) => {
            const local = await innerDb.getFirstAsync<{ id: number; updated_at: string | null; sync_status: string }>(
                'SELECT id, updated_at, sync_status FROM exercises WHERE uuid = ? LIMIT 1',
                row.uuid
            )
            if (shouldSkipRemoteRow(local, row.updated_at)) return

            const cols = toExerciseColumns(row, userId)
            if (local) {
                await innerDb.runAsync(
                    `UPDATE exercises
           SET user_id = ?, name = ?, type = ?, muscle_group = ?, photo_uri = ?, position = ?, created_at = ?, updated_at = ?,
               deleted_at = NULL, sync_status = 'synced', last_synced_at = ?
           WHERE uuid = ?`,
                    cols.user_id,
                    cols.name,
                    cols.type,
                    cols.muscle_group,
                    cols.photo_uri,
                    cols.position,
                    cols.created_at,
                    cols.updated_at,
                    nowIso(),
                    row.uuid
                )
            } else {
                await innerDb.runAsync(
                    `INSERT INTO exercises
           (uuid, user_id, name, type, muscle_group, photo_uri, position, created_at, updated_at, deleted_at, sync_status, last_synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'synced', ?)`,
                    row.uuid,
                    cols.user_id,
                    cols.name,
                    cols.type,
                    cols.muscle_group,
                    cols.photo_uri,
                    cols.position,
                    cols.created_at,
                    cols.updated_at,
                    nowIso()
                )
            }
        })
        nextUpdated = maxIso(nextUpdated, row.updated_at)
    }

    const deleted = await request<DeletedRow[]>('exercises', {
        query: {
            select: 'uuid,deleted_at',
            user_id: `eq.${userId}`,
            deleted_at: cursors.exercisesDeleted ? `gt.${cursors.exercisesDeleted}` : 'not.is.null',
            order: 'deleted_at.asc',
        },
    })
    const nextDeleted = await applyRemoteDeletions('exercises', deleted, cursors.exercisesDeleted)

    setCursors(userId, {
        ...cursors,
        exercisesUpdated: nextUpdated,
        exercisesDeleted: nextDeleted,
    })

    return remote.length + deleted.length
}

const pullWorkouts = async (userId: string): Promise<number> => {
    const cursors = getCursors(userId)
    const remote = await request<RemoteSimpleRow[]>('workouts', {
        query: {
            select: '*',
            user_id: `eq.${userId}`,
            deleted_at: 'is.null',
            order: 'updated_at.asc',
            ...(cursors.workoutsUpdated ? { updated_at: `gt.${cursors.workoutsUpdated}` } : {}),
        },
    })

    let nextUpdated = cursors.workoutsUpdated
    for (const row of remote) {
        await executeWriteTransaction(async (db) => {
            const local = await db.getFirstAsync<{ id: number; updated_at: string | null; sync_status: string }>(
                'SELECT id, updated_at, sync_status FROM workouts WHERE uuid = ? LIMIT 1',
                row.uuid
            )
            if (shouldSkipRemoteRow(local, row.updated_at)) return

            const cols = toWorkoutColumns(row, userId)
            if (local) {
                await db.runAsync(
                    `UPDATE workouts
           SET user_id = ?, date = ?, start_time = ?, end_time = ?, status = ?, note = ?,
               created_at = ?, updated_at = ?, deleted_at = NULL, sync_status = 'synced', last_synced_at = ?
           WHERE uuid = ?`,
                    cols.user_id,
                    cols.date,
                    cols.start_time,
                    cols.end_time,
                    cols.status,
                    cols.note,
                    cols.created_at,
                    cols.updated_at,
                    nowIso(),
                    row.uuid
                )
            } else {
                await db.runAsync(
                    `INSERT INTO workouts
           (uuid, user_id, date, start_time, end_time, status, note, created_at, updated_at, deleted_at, sync_status, last_synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'synced', ?)`,
                    row.uuid,
                    cols.user_id,
                    cols.date,
                    cols.start_time,
                    cols.end_time,
                    cols.status,
                    cols.note,
                    cols.created_at,
                    cols.updated_at,
                    nowIso()
                )
            }
        })
        nextUpdated = maxIso(nextUpdated, row.updated_at)
    }

    const deleted = await request<DeletedRow[]>('workouts', {
        query: {
            select: 'uuid,deleted_at',
            user_id: `eq.${userId}`,
            deleted_at: cursors.workoutsDeleted ? `gt.${cursors.workoutsDeleted}` : 'not.is.null',
            order: 'deleted_at.asc',
        },
    })
    const nextDeleted = await applyRemoteDeletions('workouts', deleted, cursors.workoutsDeleted)

    setCursors(userId, {
        ...cursors,
        workoutsUpdated: nextUpdated,
        workoutsDeleted: nextDeleted,
    })

    return remote.length + deleted.length
}

const toSingleRef = (value: { uuid: string } | { uuid: string }[] | null | undefined) => {
    if (!value) return null
    if (Array.isArray(value)) return value[0] ?? null
    return value
}

const pullSets = async (userId: string): Promise<number> => {
    const cursors = getCursors(userId)
    const remote = await request<RemoteSetWithRefs[]>('sets', {
        query: {
            select: 'uuid,user_id,weight,reps,distance,duration,rpe,position,sub_sets,created_at,updated_at,deleted_at,workouts(uuid),exercises(uuid)',
            user_id: `eq.${userId}`,
            deleted_at: 'is.null',
            order: 'updated_at.asc',
            ...(cursors.setsUpdated ? { updated_at: `gt.${cursors.setsUpdated}` } : {}),
        },
    })

    let nextUpdated = cursors.setsUpdated
    // Once a set is held back because its parent isn't local yet, the cursor
    // must stop advancing entirely: rows arrive ordered by updated_at asc, so
    // letting a later row move the watermark would still skip past the held
    // set and it would never be re-fetched.
    let cursorStalled = false
    for (const row of remote) {
        const workoutUuid = toSingleRef(row.workouts)?.uuid
        const exerciseUuid = toSingleRef(row.exercises)?.uuid
        if (!workoutUuid || !exerciseUuid) {
            // No parent refs on the server side at all — terminal, not
            // transient; the set will be removed by delete propagation.
            if (!cursorStalled) nextUpdated = maxIso(nextUpdated, row.updated_at)
            continue
        }

        let parentMissing = false
        await executeWriteTransaction(async (db) => {
            const [workoutLocal, exerciseLocal] = await Promise.all([
                db.getFirstAsync<{ id: number }>('SELECT id FROM workouts WHERE uuid = ? LIMIT 1', workoutUuid),
                db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE uuid = ? LIMIT 1', exerciseUuid),
            ])
            if (!workoutLocal?.id || !exerciseLocal?.id) {
                parentMissing = true
                return
            }

            const local = await db.getFirstAsync<{ id: number; updated_at: string | null; sync_status: string }>(
                'SELECT id, updated_at, sync_status FROM sets WHERE uuid = ? LIMIT 1',
                row.uuid
            )
            if (shouldSkipRemoteRow(local, row.updated_at)) return

            const cols = toSetColumns(row, userId, workoutLocal.id, exerciseLocal.id)
            if (local) {
                await db.runAsync(
                    `UPDATE sets
           SET user_id = ?, workout_id = ?, exercise_id = ?, weight = ?, reps = ?, distance = ?, duration = ?, rpe = ?, position = ?, sub_sets = ?,
               created_at = ?, updated_at = ?, deleted_at = NULL, sync_status = 'synced', last_synced_at = ?
           WHERE uuid = ?`,
                    cols.user_id,
                    cols.workout_id,
                    cols.exercise_id,
                    cols.weight,
                    cols.reps,
                    cols.distance,
                    cols.duration,
                    cols.rpe,
                    cols.position,
                    cols.sub_sets,
                    cols.created_at,
                    cols.updated_at,
                    nowIso(),
                    row.uuid
                )
            } else {
                await db.runAsync(
                    `INSERT INTO sets
           (uuid, user_id, workout_id, exercise_id, weight, reps, distance, duration, rpe, position, sub_sets, created_at, updated_at, deleted_at, sync_status, last_synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'synced', ?)`,
                    row.uuid,
                    cols.user_id,
                    cols.workout_id,
                    cols.exercise_id,
                    cols.weight,
                    cols.reps,
                    cols.distance,
                    cols.duration,
                    cols.rpe,
                    cols.position,
                    cols.sub_sets,
                    cols.created_at,
                    cols.updated_at,
                    nowIso()
                )
            }
        })

        if (parentMissing) {
            cursorStalled = true
            continue
        }
        if (!cursorStalled) nextUpdated = maxIso(nextUpdated, row.updated_at)
    }

    const deleted = await request<DeletedRow[]>('sets', {
        query: {
            select: 'uuid,deleted_at',
            user_id: `eq.${userId}`,
            deleted_at: cursors.setsDeleted ? `gt.${cursors.setsDeleted}` : 'not.is.null',
            order: 'deleted_at.asc',
        },
    })
    const nextDeleted = await applyRemoteDeletions('sets', deleted, cursors.setsDeleted)

    setCursors(userId, {
        ...cursors,
        setsUpdated: nextUpdated,
        setsDeleted: nextDeleted,
    })

    return remote.length + deleted.length
}

const livePrincipalFromSession = (): LivePrincipal => {
    const session = getSupabaseSession()
    return { userId: session?.userId ?? null, remote: shouldUseRemoteSync() }
}

export const runSync = async (): Promise<SyncCycleResult> => {
    if (!shouldUseRemoteSync()) return IDLE_RESULT
    const live = livePrincipalFromSession()
    const config = getSupabaseConfig()
    if (!config || !live.userId) return IDLE_RESULT

    const snapshot = capturePrincipalSnapshot(live)
    if (snapshot.mode !== 'account' || !snapshot.userId) return IDLE_RESULT

    if (currentRun) return currentRun
    currentRun = (async (): Promise<SyncCycleResult> => {
        const startedAt = nowIso()
        syncStatusStore.set({ kind: 'running' })
        await updateSyncState({ is_syncing: 1, last_attempt_at: startedAt, last_error: null })

        try {
            const db = await getDb()
            // Short-circuit the push half of the cycle when the outbox is
            // empty. Avoids creating the adapter, resolver, and write
            // transactions for `drainOutbox` — the cheap exit path described
            // in issue #26.
            const outboxSizeBefore = await getOutboxSize(snapshot.userId as string)
            let aborted = false
            let failures: CycleResult['failures'] = []
            let pushed = 0

            if (outboxSizeBefore > 0) {
                const outbox = createOutbox(db, executeWriteTransaction)
                const adapter = createSupabaseHttpAdapter()
                const writer = createRemoteWriter(adapter)
                const resolver = createRemoteIdResolver(adapter)
                const result = await drainOutbox(
                    outbox,
                    snapshot,
                    makePushFn(snapshot, writer, resolver),
                    livePrincipalFromSession,
                    (batch) => preloadSetParents(resolver, batch)
                )
                aborted = result.aborted
                failures = result.failures
                pushed = result.acked
            }

            // Only failures left to retry raise the banner. Rows parked as
            // 'blocked' are terminal — they surface as a quiet count instead, so
            // a poison row can't keep the banner stuck failed every cycle.
            const retryableFailures = failures.filter((f) => !f.blocked)

            let pulled = 0
            if (!aborted) {
                const exPulled = await pullExercises(snapshot.userId as string)
                // Sync pull writes exercises directly via raw SQL, bypassing
                // the cached repository wrapper. Invalidate explicitly so the
                // next read reflects server changes.
                if (exPulled > 0) invalidateExercisesCache()
                const wkPulled = await pullWorkouts(snapshot.userId as string)
                const stPulled = await pullSets(snapshot.userId as string)
                pulled = exPulled + wkPulled + stPulled
            }

            if (retryableFailures.length > 0 || aborted) {
                const rows: SyncFailure[] = aborted
                    ? [
                          {
                              entityType: 'tombstone',
                              uuid: '',
                              reason: { kind: 'principal-diverged', message: 'principal changed mid-cycle' },
                          },
                      ]
                    : retryableFailures.map((f) => ({
                          entityType: f.row.kind === 'tombstone' ? 'tombstone' : f.row.entityType,
                          uuid: f.row.uuid,
                          reason: f.reason,
                      }))
                syncStatusStore.set({ kind: 'failed', rows, lastAttemptAt: startedAt })
                await updateSyncState({
                    is_syncing: 0,
                    outbox_size: await getOutboxSize(snapshot.userId as string),
                    last_error: aborted
                        ? 'Sync aborted: principal changed mid-cycle.'
                        : `Sync completed with ${retryableFailures.length} failed push operations.`,
                })
                return { skipped: false, pushed, pulled, failed: retryableFailures.length, aborted }
            }

            syncStatusStore.set({ kind: 'idle' })
            await updateSyncState({
                is_syncing: 0,
                outbox_size: await getOutboxSize(snapshot.userId as string),
                last_success_at: nowIso(),
                last_error: null,
            })
            return { skipped: false, pushed, pulled, failed: 0, aborted: false }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            syncStatusStore.set({
                kind: 'failed',
                rows: [{ entityType: 'tombstone', uuid: '', reason: { kind: 'unknown', message } }],
                lastAttemptAt: startedAt,
            })
            await updateSyncState({
                is_syncing: 0,
                outbox_size: await getOutboxSize(snapshot.userId as string),
                last_error: message,
            })
            return { skipped: false, pushed: 0, pulled: 0, failed: 1, aborted: false }
        } finally {
            currentRun = null
        }
    })()

    return currentRun
}

export const getSyncState = async (): Promise<SyncState> => {
    const db = await getDb()
    const userId = getSupabaseSession()?.userId
    const scopedOutboxSize = await getOutboxSize(userId)
    const scopedBlockedSize = await getBlockedSize(userId)
    const row = await db.getFirstAsync<Omit<SyncState, 'blocked_size'>>(
        'SELECT is_syncing, outbox_size, last_success_at, last_attempt_at, last_error FROM sync_state WHERE id = 1'
    )
    if (row) {
        return {
            ...row,
            outbox_size: scopedOutboxSize,
            blocked_size: scopedBlockedSize,
        }
    }

    return {
        is_syncing: 0,
        outbox_size: scopedOutboxSize,
        last_attempt_at: null,
        last_success_at: null,
        last_error: null,
        blocked_size: scopedBlockedSize,
    }
}

// Un-parks every blocked row (resets it to 'dirty' with a fresh attempt count)
// so the next sync re-attempts it. Backs the user-facing "Try again" action.
export const retryBlockedRows = async (): Promise<void> => {
    const userId = getSupabaseSession()?.userId
    const shouldScopeByUser = shouldUseRemoteSync() && !!userId
    const userScopeClause = shouldScopeByUser ? 'AND user_id = ?' : ''
    const userScopeParams = shouldScopeByUser ? [userId as string] : []
    const tables = ['exercises', 'workouts', 'sets', 'deletion_tombstones'] as const
    await executeWriteTransaction(async (db) => {
        for (const table of tables) {
            await db.runAsync(
                `UPDATE ${table} SET sync_status = 'dirty', sync_attempts = 0 WHERE sync_status = 'blocked' ${userScopeClause}`,
                ...userScopeParams
            )
        }
    })
}
