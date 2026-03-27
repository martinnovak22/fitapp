import { getSupabaseConfig } from '@/src/data/remote/supabase/config'
import { getSupabaseSession } from '@/src/data/remote/supabase/session'
import { isRemoteDataMode } from '@/src/modules/auth/authMode'
import { getDb } from '@/src/db/client'
import { executeWrite, executeWriteTransaction } from '@/src/db/writeQueue'
import { nowIso } from '@/src/db/sync'

type SyncState = {
    is_syncing: number
    outbox_size: number
    last_success_at: string | null
    last_attempt_at: string | null
    last_error: string | null
}

type SyncTable = 'exercises' | 'workouts' | 'sets'
type EntityType = 'exercise' | 'workout' | 'set'

type ExerciseRow = {
    uuid: string
    user_id: string | null
    name: string
    type: string
    muscle_group: string | null
    photo_uri: string | null
    position: number
    created_at: string | null
    updated_at: string | null
    deleted_at: string | null
    sync_status: 'local' | 'dirty' | 'synced' | 'failed'
}

type WorkoutRow = {
    uuid: string
    user_id: string | null
    date: string
    start_time: string | null
    end_time: string | null
    status: 'in_progress' | 'finished'
    note: string | null
    created_at: string | null
    updated_at: string | null
    deleted_at: string | null
    sync_status: 'local' | 'dirty' | 'synced' | 'failed'
}

type SetRow = {
    uuid: string
    user_id: string | null
    workout_id: number
    exercise_id: number
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
    sync_status: 'local' | 'dirty' | 'synced' | 'failed'
}

type DirtySetRow = SetRow & {
    workout_uuid: string
    exercise_uuid: string
}

type TombstoneRow = {
    id: number
    entity_type: EntityType
    entity_uuid: string
    user_id: string | null
    deleted_at: string
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

const DIRTY_STATUSES = `('dirty','failed')`

let currentRun: Promise<void> | null = null

const tableByEntityType: Record<EntityType, SyncTable> = {
    exercise: 'exercises',
    workout: 'workouts',
    set: 'sets',
}

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
    const [exerciseCount, workoutCount, setCount, tombstoneCount] = await Promise.all([
        db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM exercises WHERE sync_status IN ${DIRTY_STATUSES} ${userScopeClause}`,
            ...userScopeParams
        ),
        db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM workouts WHERE sync_status IN ${DIRTY_STATUSES} ${userScopeClause}`,
            ...userScopeParams
        ),
        db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM sets WHERE sync_status IN ${DIRTY_STATUSES} ${userScopeClause}`, ...userScopeParams),
        db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM deletion_tombstones WHERE sync_status IN ${DIRTY_STATUSES} ${userScopeClause}`,
            ...userScopeParams
        ),
    ])
    return (
        (exerciseCount?.count ?? 0) + (workoutCount?.count ?? 0) + (setCount?.count ?? 0) + (tombstoneCount?.count ?? 0)
    )
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

    await executeWrite((db) => db.runAsync(`UPDATE sync_state SET ${updates.join(', ')} WHERE id = 1`, ...values))
}

const setEntitySyncedIfUnchanged = async (table: SyncTable, uuid: string, expectedUpdatedAt: string | null) => {
    const syncedAt = nowIso()
    await executeWrite((db) =>
        db.runAsync(
            `UPDATE ${table}
      SET sync_status = 'synced',
          last_synced_at = ?,
          updated_at = COALESCE(updated_at, ?)
      WHERE uuid = ?
        AND sync_status IN ${DIRTY_STATUSES}
        AND ((? IS NULL AND updated_at IS NULL) OR updated_at = ?)`,
            syncedAt,
            syncedAt,
            uuid,
            expectedUpdatedAt,
            expectedUpdatedAt
        )
    )
}

const setEntityFailedIfUnchanged = async (table: SyncTable, uuid: string, expectedUpdatedAt: string | null) => {
    await executeWrite((db) =>
        db.runAsync(
            `UPDATE ${table}
      SET sync_status = 'failed'
      WHERE uuid = ?
        AND sync_status IN ${DIRTY_STATUSES}
        AND ((? IS NULL AND updated_at IS NULL) OR updated_at = ?)`,
            uuid,
            expectedUpdatedAt,
            expectedUpdatedAt
        )
    )
}

const pushExercises = async (userId: string): Promise<number> => {
    const db = await getDb()
    let failures = 0
    const rows = await db.getAllAsync<ExerciseRow>(
        `SELECT uuid, user_id, name, type, muscle_group, photo_uri, position, created_at, updated_at, deleted_at, sync_status
     FROM exercises
     WHERE sync_status IN ${DIRTY_STATUSES} AND user_id = ?
     ORDER BY updated_at ASC`,
        userId
    )
    for (const row of rows) {
        try {
            await request<unknown>('exercises', {
                method: 'POST',
                query: { on_conflict: 'uuid' },
                prefer: 'resolution=merge-duplicates',
                body: {
                    uuid: row.uuid,
                    user_id: userId,
                    name: row.name,
                    type: row.type,
                    muscle_group: row.muscle_group,
                    photo_uri: row.photo_uri,
                    position: row.position,
                    created_at: toIsoOrNow(row.created_at),
                    updated_at: toIsoOrNow(row.updated_at),
                    deleted_at: row.deleted_at,
                    sync_status: 'dirty',
                },
            })
            await setEntitySyncedIfUnchanged('exercises', row.uuid, row.updated_at ?? null)
        } catch {
            failures += 1
            await setEntityFailedIfUnchanged('exercises', row.uuid, row.updated_at ?? null)
        }
    }
    return failures
}

const pushWorkouts = async (userId: string): Promise<number> => {
    const db = await getDb()
    let failures = 0
    const rows = await db.getAllAsync<WorkoutRow>(
        `SELECT uuid, user_id, date, start_time, end_time, status, note, created_at, updated_at, deleted_at, sync_status
     FROM workouts
     WHERE sync_status IN ${DIRTY_STATUSES} AND user_id = ?
     ORDER BY updated_at ASC`,
        userId
    )
    for (const row of rows) {
        try {
            await request<unknown>('workouts', {
                method: 'POST',
                query: { on_conflict: 'uuid' },
                prefer: 'resolution=merge-duplicates',
                body: {
                    uuid: row.uuid,
                    user_id: userId,
                    date: row.date,
                    start_time: row.start_time,
                    end_time: row.end_time,
                    status: row.status,
                    note: row.note,
                    created_at: toIsoOrNow(row.created_at),
                    updated_at: toIsoOrNow(row.updated_at),
                    deleted_at: row.deleted_at,
                    sync_status: 'dirty',
                },
            })
            await setEntitySyncedIfUnchanged('workouts', row.uuid, row.updated_at ?? null)
        } catch {
            failures += 1
            await setEntityFailedIfUnchanged('workouts', row.uuid, row.updated_at ?? null)
        }
    }
    return failures
}

const getRemoteIdByUuid = async (table: 'exercises' | 'workouts', uuid: string, cache: Map<string, number>) => {
    const cached = cache.get(uuid)
    if (cached) return cached

    const rows = await request<{ id: number }[]>(table, {
        query: { select: 'id', uuid: `eq.${uuid}`, limit: '1' },
    })
    const id = rows[0]?.id
    if (!id) return null
    cache.set(uuid, id)
    return id
}

const pushSets = async (userId: string): Promise<number> => {
    const db = await getDb()
    let failures = 0
    const rows = await db.getAllAsync<DirtySetRow>(
        `SELECT
      s.uuid,
      s.user_id,
      s.workout_id,
      s.exercise_id,
      s.weight,
      s.reps,
      s.distance,
      s.duration,
      s.rpe,
      s.position,
      s.sub_sets,
      s.created_at,
      s.updated_at,
      s.deleted_at,
      s.sync_status,
      w.uuid as workout_uuid,
      e.uuid as exercise_uuid
    FROM sets s
    JOIN workouts w ON w.id = s.workout_id
    JOIN exercises e ON e.id = s.exercise_id
    WHERE s.sync_status IN ${DIRTY_STATUSES}
      AND s.user_id = ?
      AND w.user_id = ?
      AND e.user_id = ?
    ORDER BY s.updated_at ASC`,
        userId,
        userId,
        userId
    )

    const workoutIdCache = new Map<string, number>()
    const exerciseIdCache = new Map<string, number>()

    for (const row of rows) {
        try {
            const [remoteWorkoutId, remoteExerciseId] = await Promise.all([
                getRemoteIdByUuid('workouts', row.workout_uuid, workoutIdCache),
                getRemoteIdByUuid('exercises', row.exercise_uuid, exerciseIdCache),
            ])
            if (!remoteWorkoutId || !remoteExerciseId) {
                failures += 1
                await setEntityFailedIfUnchanged('sets', row.uuid, row.updated_at ?? null)
                continue
            }

            await request<unknown>('sets', {
                method: 'POST',
                query: { on_conflict: 'uuid' },
                prefer: 'resolution=merge-duplicates',
                body: {
                    uuid: row.uuid,
                    user_id: userId,
                    workout_id: remoteWorkoutId,
                    exercise_id: remoteExerciseId,
                    weight: row.weight,
                    reps: row.reps,
                    distance: row.distance,
                    duration: row.duration,
                    rpe: row.rpe,
                    position: row.position,
                    sub_sets: row.sub_sets,
                    created_at: toIsoOrNow(row.created_at),
                    updated_at: toIsoOrNow(row.updated_at),
                    deleted_at: row.deleted_at,
                    sync_status: 'dirty',
                },
            })
            await setEntitySyncedIfUnchanged('sets', row.uuid, row.updated_at ?? null)
        } catch {
            failures += 1
            await setEntityFailedIfUnchanged('sets', row.uuid, row.updated_at ?? null)
        }
    }
    return failures
}

const pushDeletions = async (userId: string): Promise<number> => {
    const db = await getDb()
    let failures = 0
    const tombstones = await db.getAllAsync<TombstoneRow>(
        `SELECT id, entity_type, entity_uuid, user_id, deleted_at
     FROM deletion_tombstones
     WHERE sync_status IN ${DIRTY_STATUSES}
       AND user_id = ?
     ORDER BY deleted_at ASC`,
        userId
    )

    for (const tombstone of tombstones) {
        const targetTable = tableByEntityType[tombstone.entity_type]
        try {
            await request<unknown>(targetTable, {
                method: 'PATCH',
                query: { uuid: `eq.${tombstone.entity_uuid}`, user_id: `eq.${userId}` },
                body: {
                    deleted_at: tombstone.deleted_at,
                    updated_at: tombstone.deleted_at,
                    sync_status: 'dirty',
                },
            })

            await executeWrite((innerDb) =>
                innerDb.runAsync(`UPDATE deletion_tombstones SET sync_status = 'synced' WHERE id = ?`, tombstone.id)
            )
        } catch {
            failures += 1
            await executeWrite((innerDb) =>
                innerDb.runAsync(`UPDATE deletion_tombstones SET sync_status = 'failed' WHERE id = ?`, tombstone.id)
            )
        }
    }
    return failures
}

const pullExercises = async (userId: string) => {
    const remote = await request<ExerciseRow[]>('exercises', {
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
                    row.name,
                    row.type,
                    row.muscle_group,
                    row.photo_uri,
                    row.position,
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
                    row.name,
                    row.type,
                    row.muscle_group,
                    row.photo_uri,
                    row.position,
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
    const remote = await request<WorkoutRow[]>('workouts', {
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
                    row.date,
                    row.start_time,
                    row.end_time,
                    row.status,
                    row.note,
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
                    row.date,
                    row.start_time,
                    row.end_time,
                    row.status,
                    row.note,
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

export const runSync = async () => {
    if (!shouldUseRemoteSync()) return
    const session = getSupabaseSession()
    const config = getSupabaseConfig()
    if (!config || !session?.userId) return

    if (currentRun) return currentRun
    currentRun = (async () => {
        const startedAt = nowIso()
        await updateSyncState({ is_syncing: 1, last_attempt_at: startedAt, last_error: null })

        try {
            const pushFailures =
                (await pushExercises(session.userId)) +
                (await pushWorkouts(session.userId)) +
                (await pushSets(session.userId)) +
                (await pushDeletions(session.userId))

            await pullExercises(session.userId)
            await pullWorkouts(session.userId)
            await pullSets(session.userId)

            if (pushFailures > 0) {
                throw new Error(`Sync completed with ${pushFailures} failed push operations.`)
            }

            await updateSyncState({
                is_syncing: 0,
                outbox_size: await getOutboxSize(session.userId),
                last_success_at: nowIso(),
                last_error: null,
            })
        } catch (error) {
            await updateSyncState({
                is_syncing: 0,
                outbox_size: await getOutboxSize(session.userId),
                last_error: error instanceof Error ? error.message : String(error),
            })
            throw error
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
            // Always report live outbox for current account scope.
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
