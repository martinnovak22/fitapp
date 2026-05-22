// Outbox: the only module that knows which local rows need syncing and in what
// order. Hides the sync_status column from callers and owns ack/fail transitions.

import type * as SQLite from 'expo-sqlite'
import type { PrincipalSnapshot } from './PrincipalSnapshot'

export type OutboxEntityType = 'exercise' | 'workout' | 'set'

export type EntityTable = 'exercises' | 'workouts' | 'sets'

export type SyncFailureKind =
    | 'network-error'
    | 'remote-rejection'
    | 'missing-parent'
    | 'principal-diverged'
    | 'unknown'

export type SyncFailureReason = Readonly<{
    kind: SyncFailureKind
    message: string
}>

export type ExerciseRow = {
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
}

export type WorkoutRow = {
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
}

export type SetRowWithRefs = {
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
    workout_uuid: string
    exercise_uuid: string
}

type EntityVariant<E extends OutboxEntityType, R> = Readonly<{
    kind: 'entity'
    entityType: E
    uuid: string
    updatedAt: string | null
    row: Readonly<R>
}>

type TombstoneVariant = Readonly<{
    kind: 'tombstone'
    tombstoneId: number
    entityType: OutboxEntityType
    uuid: string
    userId: string | null
    deletedAt: string
}>

export type OutboxRow =
    | EntityVariant<'exercise', ExerciseRow>
    | EntityVariant<'workout', WorkoutRow>
    | EntityVariant<'set', SetRowWithRefs>
    | TombstoneVariant

type SqliteLike = Pick<SQLite.SQLiteDatabase, 'getAllAsync' | 'runAsync'>

type RunWrite = <T>(op: (db: SQLite.SQLiteDatabase) => Promise<T>) => Promise<T>

export type Outbox = {
    nextBatch(snapshot: PrincipalSnapshot): Promise<OutboxRow[]>
    ack(rows: OutboxRow[]): Promise<void>
    fail(rows: OutboxRow[], reason: SyncFailureReason): Promise<void>
}

export const DIRTY_STATUSES = `('dirty','failed')`

export const tableOf = (entityType: OutboxEntityType): EntityTable =>
    entityType === 'exercise' ? 'exercises' : entityType === 'workout' ? 'workouts' : 'sets'

const EXERCISE_COLS =
    'uuid, user_id, name, type, muscle_group, photo_uri, position, created_at, updated_at, deleted_at'
const WORKOUT_COLS =
    'uuid, user_id, date, start_time, end_time, status, note, created_at, updated_at, deleted_at'
const SET_COLS = `s.uuid, s.user_id, s.workout_id, s.exercise_id, s.weight, s.reps,
    s.distance, s.duration, s.rpe, s.position, s.sub_sets, s.created_at, s.updated_at,
    s.deleted_at, w.uuid as workout_uuid, e.uuid as exercise_uuid`

const selectDirty = <T extends { uuid: string; updated_at: string | null }>(
    db: SqliteLike,
    table: EntityTable,
    columns: string,
    snapshot: PrincipalSnapshot
): Promise<T[]> =>
    db.getAllAsync<T>(
        `SELECT ${columns} FROM ${table}
        WHERE sync_status IN ${DIRTY_STATUSES} AND ${snapshot.scopeClause}
        ORDER BY updated_at ASC, uuid ASC`,
        ...snapshot.scopeParams
    )

const selectDirtySets = (db: SqliteLike, snapshot: PrincipalSnapshot): Promise<SetRowWithRefs[]> => {
    const setScope = snapshot.scopeClause.replace(/user_id/g, 's.user_id')
    const setParentScope =
        snapshot.mode === 'account'
            ? 'AND w.user_id = ? AND e.user_id = ?'
            : 'AND w.user_id IS NULL AND e.user_id IS NULL'
    const setParams =
        snapshot.mode === 'account'
            ? [...snapshot.scopeParams, ...snapshot.scopeParams, ...snapshot.scopeParams]
            : []
    return db.getAllAsync<SetRowWithRefs>(
        `SELECT ${SET_COLS}
        FROM sets s
        JOIN workouts w ON w.id = s.workout_id
        JOIN exercises e ON e.id = s.exercise_id
        WHERE s.sync_status IN ${DIRTY_STATUSES} AND ${setScope} ${setParentScope}
        ORDER BY s.updated_at ASC, s.uuid ASC`,
        ...setParams
    )
}

const updateEntityStatus = (
    write: RunWrite,
    row: Exclude<OutboxRow, TombstoneVariant>,
    setClause: string,
    extraValues: (string | number | null)[]
) =>
    write((db) =>
        db.runAsync(
            `UPDATE ${tableOf(row.entityType)}
            SET ${setClause}
            WHERE uuid = ?
              AND sync_status IN ${DIRTY_STATUSES}
              AND ((? IS NULL AND updated_at IS NULL) OR updated_at = ?)`,
            ...extraValues,
            row.uuid,
            row.updatedAt,
            row.updatedAt
        )
    )

const updateTombstoneStatus = (write: RunWrite, id: number, status: 'synced' | 'failed') =>
    write((db) =>
        db.runAsync(`UPDATE deletion_tombstones SET sync_status = ? WHERE id = ?`, status, id)
    )

export const createOutbox = (read: SqliteLike, write: RunWrite): Outbox => ({
    async nextBatch(snapshot) {
        const exercises = await selectDirty<ExerciseRow>(read, 'exercises', EXERCISE_COLS, snapshot)
        const workouts = await selectDirty<WorkoutRow>(read, 'workouts', WORKOUT_COLS, snapshot)
        const sets = await selectDirtySets(read, snapshot)
        const tombstones = await read.getAllAsync<{
            id: number
            entity_type: OutboxEntityType
            entity_uuid: string
            user_id: string | null
            deleted_at: string
        }>(
            `SELECT id, entity_type, entity_uuid, user_id, deleted_at
            FROM deletion_tombstones
            WHERE sync_status IN ${DIRTY_STATUSES} AND ${snapshot.scopeClause}
            ORDER BY deleted_at ASC, id ASC`,
            ...snapshot.scopeParams
        )

        return [
            ...exercises.map(
                (row): OutboxRow => ({
                    kind: 'entity',
                    entityType: 'exercise',
                    uuid: row.uuid,
                    updatedAt: row.updated_at,
                    row,
                })
            ),
            ...workouts.map(
                (row): OutboxRow => ({
                    kind: 'entity',
                    entityType: 'workout',
                    uuid: row.uuid,
                    updatedAt: row.updated_at,
                    row,
                })
            ),
            ...sets.map(
                (row): OutboxRow => ({
                    kind: 'entity',
                    entityType: 'set',
                    uuid: row.uuid,
                    updatedAt: row.updated_at,
                    row,
                })
            ),
            ...tombstones.map(
                (t): OutboxRow => ({
                    kind: 'tombstone',
                    tombstoneId: t.id,
                    entityType: t.entity_type,
                    uuid: t.entity_uuid,
                    userId: t.user_id,
                    deletedAt: t.deleted_at,
                })
            ),
        ]
    },

    async ack(rows) {
        for (const row of rows) {
            if (row.kind === 'tombstone') {
                await updateTombstoneStatus(write, row.tombstoneId, 'synced')
            } else {
                await updateEntityStatus(write, row, `sync_status = 'synced', last_synced_at = ?`, [
                    new Date().toISOString(),
                ])
            }
        }
    },

    async fail(rows, _reason) {
        // The structured reason is surfaced to callers via the cycle's return
        // value; durable persistence of the reason belongs to the SyncStatus slice.
        for (const row of rows) {
            if (row.kind === 'tombstone') {
                await updateTombstoneStatus(write, row.tombstoneId, 'failed')
            } else {
                await updateEntityStatus(write, row, `sync_status = 'failed'`, [])
            }
        }
    },
})
