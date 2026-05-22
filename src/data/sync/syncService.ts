import { getSupabaseConfig } from '@/src/data/remote/supabase/config'
import { getSupabaseSession } from '@/src/data/remote/supabase/session'
import { isRemoteDataMode } from '@/src/modules/auth/authMode'
import { getDb } from '@/src/db/client'
import { executeWriteTransaction } from '@/src/db/writeQueue'
import { nowIso } from '@/src/db/sync'
import { createOutbox, DIRTY_STATUSES } from './Outbox'
import { capturePrincipalSnapshot, type LivePrincipal } from './PrincipalSnapshot'
import { drainOutbox } from './SyncCycle'
import type { RemoteAdapter } from './RemoteAdapter'
import { createRemoteIdResolver } from './RemoteIdResolver'
import { createRemoteWriter } from './RemoteWriter'
import { makePushFn, preloadSetParents } from './PushPipeline'
import { syncStatusStore, type SyncFailure } from './SyncStatus'

type SyncState = {
    is_syncing: number
    outbox_size: number
    last_success_at: string | null
    last_attempt_at: string | null
    last_error: string | null
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

let currentRun: Promise<void> | null = null

const toIsoOrNow = (value?: string | null) => value ?? nowIso()

const parseIsoMillis = (value: string | null | undefined) => {
    if (!value) return 0
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
}

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
    const response = await fetch(url, {
        method: options?.method ?? 'GET',
        headers: {
            apikey: config.publicKey,
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
            ...(options?.prefer ? { Prefer: options.prefer } : {}),
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
    })
    const text = await response.text()
    const payload = text ? (JSON.parse(text) as T) : (null as T)
    if (!response.ok) {
        const normalized = text.toLowerCase()
        if (response.status === 401 && normalized.includes('jwt expired')) {
            throw new Error('Sync auth expired. Please sign in again.')
        }
        throw new Error(`Sync request failed (${table}): ${response.status} ${response.statusText} ${text}`)
    }
    return payload
}

const getOutboxSize = async (userId?: string) => {
    const db = await getDb()
    const shouldScopeByUser = shouldUseRemoteSync() && !!userId
    const userScopeClause = shouldScopeByUser ? 'AND user_id = ?' : ''
    const userScopeParams = shouldScopeByUser ? [userId as string] : []
    const tables = ['exercises', 'workouts', 'sets', 'deletion_tombstones'] as const
    const counts = await Promise.all(
        tables.map((table) =>
            db.getFirstAsync<{ count: number }>(
                `SELECT COUNT(*) as count FROM ${table} WHERE sync_status IN ${DIRTY_STATUSES} ${userScopeClause}`,
                ...userScopeParams
            )
        )
    )
    return counts.reduce((sum, row) => sum + (row?.count ?? 0), 0)
}

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


const pullExercises = async (userId: string) => {
    const remote = await request<RemoteSimpleRow[]>('exercises', {
        query: { select: '*', user_id: `eq.${userId}`, deleted_at: 'is.null', order: 'updated_at.asc' },
    })

    for (const row of remote) {
        await executeWriteTransaction(async (innerDb) => {
            const local = await innerDb.getFirstAsync<{ id: number; updated_at: string | null; sync_status: string }>(
                'SELECT id, updated_at, sync_status FROM exercises WHERE uuid = ? LIMIT 1',
                row.uuid
            )
            const localIsDirty = local?.sync_status === 'dirty' || local?.sync_status === 'failed'
            if (localIsDirty && parseIsoMillis(local?.updated_at) > parseIsoMillis(row.updated_at)) return

            if (local) {
                await innerDb.runAsync(
                    `UPDATE exercises
           SET user_id = ?, name = ?, type = ?, muscle_group = ?, photo_uri = ?, position = ?, created_at = ?, updated_at = ?,
               deleted_at = NULL, sync_status = 'synced', last_synced_at = ?
           WHERE uuid = ?`,
                    userId,
                    row.name ?? null,
                    row.type ?? 'weight',
                    row.muscle_group ?? null,
                    row.photo_uri ?? null,
                    row.position ?? 0,
                    toIsoOrNow(row.created_at),
                    toIsoOrNow(row.updated_at),
                    nowIso(),
                    row.uuid
                )
            } else {
                await innerDb.runAsync(
                    `INSERT INTO exercises
           (uuid, user_id, name, type, muscle_group, photo_uri, position, created_at, updated_at, deleted_at, sync_status, last_synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'synced', ?)`,
                    row.uuid,
                    userId,
                    row.name ?? null,
                    row.type ?? 'weight',
                    row.muscle_group ?? null,
                    row.photo_uri ?? null,
                    row.position ?? 0,
                    toIsoOrNow(row.created_at),
                    toIsoOrNow(row.updated_at),
                    nowIso()
                )
            }
        })
    }

    const deleted = await request<DeletedRow[]>('exercises', {
        query: { select: 'uuid,deleted_at', user_id: `eq.${userId}`, deleted_at: 'not.is.null' },
    })
    for (const row of deleted) {
        await executeWriteTransaction(async (innerDb) => {
            const local = await innerDb.getFirstAsync<{ updated_at: string | null; sync_status: string | null }>(
                'SELECT updated_at, sync_status FROM exercises WHERE uuid = ? LIMIT 1',
                row.uuid
            )
            if (!local) return
            const localIsDirty = local.sync_status === 'dirty' || local.sync_status === 'failed'
            if (localIsDirty && parseIsoMillis(local.updated_at) > parseIsoMillis(row.deleted_at)) return
            await innerDb.runAsync('DELETE FROM exercises WHERE uuid = ?', row.uuid)
        })
    }
}

const pullWorkouts = async (userId: string) => {
    const remote = await request<RemoteSimpleRow[]>('workouts', {
        query: { select: '*', user_id: `eq.${userId}`, deleted_at: 'is.null', order: 'updated_at.asc' },
    })

    for (const row of remote) {
        await executeWriteTransaction(async (db) => {
            const local = await db.getFirstAsync<{ id: number; updated_at: string | null; sync_status: string }>(
                'SELECT id, updated_at, sync_status FROM workouts WHERE uuid = ? LIMIT 1',
                row.uuid
            )
            const localIsDirty = local?.sync_status === 'dirty' || local?.sync_status === 'failed'
            if (localIsDirty && parseIsoMillis(local?.updated_at) > parseIsoMillis(row.updated_at)) return

            if (local) {
                await db.runAsync(
                    `UPDATE workouts
           SET user_id = ?, date = ?, start_time = ?, end_time = ?, status = ?, note = ?,
               created_at = ?, updated_at = ?, deleted_at = NULL, sync_status = 'synced', last_synced_at = ?
           WHERE uuid = ?`,
                    userId,
                    row.date ?? null,
                    row.start_time ?? null,
                    row.end_time ?? null,
                    row.status ?? 'finished',
                    row.note ?? null,
                    toIsoOrNow(row.created_at),
                    toIsoOrNow(row.updated_at),
                    nowIso(),
                    row.uuid
                )
            } else {
                await db.runAsync(
                    `INSERT INTO workouts
           (uuid, user_id, date, start_time, end_time, status, note, created_at, updated_at, deleted_at, sync_status, last_synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'synced', ?)`,
                    row.uuid,
                    userId,
                    row.date ?? null,
                    row.start_time ?? null,
                    row.end_time ?? null,
                    row.status ?? 'finished',
                    row.note ?? null,
                    toIsoOrNow(row.created_at),
                    toIsoOrNow(row.updated_at),
                    nowIso()
                )
            }
        })
    }

    const deleted = await request<DeletedRow[]>('workouts', {
        query: { select: 'uuid,deleted_at', user_id: `eq.${userId}`, deleted_at: 'not.is.null' },
    })
    for (const row of deleted) {
        await executeWriteTransaction(async (db) => {
            const local = await db.getFirstAsync<{ updated_at: string | null; sync_status: string | null }>(
                'SELECT updated_at, sync_status FROM workouts WHERE uuid = ? LIMIT 1',
                row.uuid
            )
            if (!local) return
            const localIsDirty = local.sync_status === 'dirty' || local.sync_status === 'failed'
            if (localIsDirty && parseIsoMillis(local.updated_at) > parseIsoMillis(row.deleted_at)) return
            await db.runAsync('DELETE FROM workouts WHERE uuid = ?', row.uuid)
        })
    }
}

const toSingleRef = (value: { uuid: string } | { uuid: string }[] | null | undefined) => {
    if (!value) return null
    if (Array.isArray(value)) return value[0] ?? null
    return value
}

const pullSets = async (userId: string) => {
    const remote = await request<RemoteSetWithRefs[]>('sets', {
        query: {
            select: 'uuid,user_id,weight,reps,distance,duration,rpe,position,sub_sets,created_at,updated_at,deleted_at,workouts(uuid),exercises(uuid)',
            user_id: `eq.${userId}`,
            deleted_at: 'is.null',
            order: 'updated_at.asc',
        },
    })

    for (const row of remote) {
        const workoutUuid = toSingleRef(row.workouts)?.uuid
        const exerciseUuid = toSingleRef(row.exercises)?.uuid
        if (!workoutUuid || !exerciseUuid) continue

        await executeWriteTransaction(async (db) => {
            const [workoutLocal, exerciseLocal] = await Promise.all([
                db.getFirstAsync<{ id: number }>('SELECT id FROM workouts WHERE uuid = ? LIMIT 1', workoutUuid),
                db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE uuid = ? LIMIT 1', exerciseUuid),
            ])
            if (!workoutLocal?.id || !exerciseLocal?.id) return

            const local = await db.getFirstAsync<{ id: number; updated_at: string | null; sync_status: string }>(
                'SELECT id, updated_at, sync_status FROM sets WHERE uuid = ? LIMIT 1',
                row.uuid
            )
            const localIsDirty = local?.sync_status === 'dirty' || local?.sync_status === 'failed'
            if (localIsDirty && parseIsoMillis(local?.updated_at) > parseIsoMillis(row.updated_at)) return

            if (local) {
                await db.runAsync(
                    `UPDATE sets
           SET user_id = ?, workout_id = ?, exercise_id = ?, weight = ?, reps = ?, distance = ?, duration = ?, rpe = ?, position = ?, sub_sets = ?,
               created_at = ?, updated_at = ?, deleted_at = NULL, sync_status = 'synced', last_synced_at = ?
           WHERE uuid = ?`,
                    userId,
                    workoutLocal.id,
                    exerciseLocal.id,
                    row.weight,
                    row.reps,
                    row.distance,
                    row.duration,
                    row.rpe,
                    row.position,
                    row.sub_sets,
                    toIsoOrNow(row.created_at),
                    toIsoOrNow(row.updated_at),
                    nowIso(),
                    row.uuid
                )
            } else {
                await db.runAsync(
                    `INSERT INTO sets
           (uuid, user_id, workout_id, exercise_id, weight, reps, distance, duration, rpe, position, sub_sets, created_at, updated_at, deleted_at, sync_status, last_synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'synced', ?)`,
                    row.uuid,
                    userId,
                    workoutLocal.id,
                    exerciseLocal.id,
                    row.weight,
                    row.reps,
                    row.distance,
                    row.duration,
                    row.rpe,
                    row.position,
                    row.sub_sets,
                    toIsoOrNow(row.created_at),
                    toIsoOrNow(row.updated_at),
                    nowIso()
                )
            }
        })
    }

    const deleted = await request<DeletedRow[]>('sets', {
        query: { select: 'uuid,deleted_at', user_id: `eq.${userId}`, deleted_at: 'not.is.null' },
    })
    for (const row of deleted) {
        await executeWriteTransaction(async (db) => {
            const local = await db.getFirstAsync<{ updated_at: string | null; sync_status: string | null }>(
                'SELECT updated_at, sync_status FROM sets WHERE uuid = ? LIMIT 1',
                row.uuid
            )
            if (!local) return
            const localIsDirty = local.sync_status === 'dirty' || local.sync_status === 'failed'
            if (localIsDirty && parseIsoMillis(local.updated_at) > parseIsoMillis(row.deleted_at)) return
            await db.runAsync('DELETE FROM sets WHERE uuid = ?', row.uuid)
        })
    }
}

const livePrincipalFromSession = (): LivePrincipal => {
    const session = getSupabaseSession()
    return { userId: session?.userId ?? null, remote: shouldUseRemoteSync() }
}

export const runSync = async () => {
    if (!shouldUseRemoteSync()) return
    const live = livePrincipalFromSession()
    const config = getSupabaseConfig()
    if (!config || !live.userId) return

    const snapshot = capturePrincipalSnapshot(live)
    if (snapshot.mode !== 'account' || !snapshot.userId) return

    if (currentRun) return currentRun
    currentRun = (async () => {
        const startedAt = nowIso()
        syncStatusStore.set({ kind: 'running' })
        await updateSyncState({ is_syncing: 1, last_attempt_at: startedAt, last_error: null })

        try {
            const db = await getDb()
            const outbox = createOutbox(db, executeWriteTransaction)
            const adapter = createSupabaseHttpAdapter()
            const writer = createRemoteWriter(adapter)
            const resolver = createRemoteIdResolver(adapter)
            const { aborted, failed, failures } = await drainOutbox(
                outbox,
                snapshot,
                makePushFn(snapshot, writer, resolver),
                livePrincipalFromSession,
                (batch) => preloadSetParents(resolver, batch)
            )

            if (!aborted) {
                await pullExercises(snapshot.userId as string)
                await pullWorkouts(snapshot.userId as string)
                await pullSets(snapshot.userId as string)
            }

            if (failed > 0 || aborted) {
                const rows: SyncFailure[] = aborted
                    ? [
                          {
                              entityType: 'tombstone',
                              uuid: '',
                              reason: { kind: 'principal-diverged', message: 'principal changed mid-cycle' },
                          },
                      ]
                    : failures.map((f) => ({
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
                        : `Sync completed with ${failed} failed push operations.`,
                })
                return
            }

            syncStatusStore.set({ kind: 'idle' })
            await updateSyncState({
                is_syncing: 0,
                outbox_size: await getOutboxSize(snapshot.userId as string),
                last_success_at: nowIso(),
                last_error: null,
            })
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
        } finally {
            currentRun = null
        }
    })()

    return currentRun
}

export const getSyncState = async (): Promise<SyncState> => {
    const db = await getDb()
    const scopedOutboxSize = await getOutboxSize(getSupabaseSession()?.userId)
    const row = await db.getFirstAsync<SyncState>(
        'SELECT is_syncing, outbox_size, last_success_at, last_attempt_at, last_error FROM sync_state WHERE id = 1'
    )
    if (row) {
        return {
            ...row,
            outbox_size: scopedOutboxSize,
        }
    }

    return {
        is_syncing: 0,
        outbox_size: scopedOutboxSize,
        last_attempt_at: null,
        last_success_at: null,
        last_error: null,
    }
}
