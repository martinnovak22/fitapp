import { buildPrincipalWhereClause, getScopedUserId } from '@/src/data/principal'
import { getDb } from './client'
import type { Exercise } from './exercises'
import { buildSetMetricColumns, resolveNextSetPosition } from './setWriteValues'
import { createEntityUuid, nowIso, recordDeletionTombstone, type SyncStatus, softDeleteById } from './sync'
import { executeWrite, executeWriteTransaction } from './writeQueue'

export interface Workout {
    id: number
    uuid?: string
    user_id?: string | null
    date: string
    start_time: string
    end_time?: string
    status: 'in_progress' | 'finished'
    note?: string
    // The Workout Template this Workout was started from (ADR-0006). NULL for
    // an Unplanned Workout; may point at a since-deleted Template.
    template_uuid?: string | null
    created_at?: string
    updated_at?: string
    deleted_at?: string | null
    sync_status?: SyncStatus
    last_synced_at?: string | null
}

export interface SubSet {
    weight?: number
    reps?: number
    distance?: number
    duration?: number
}

export interface Set {
    id: number
    uuid?: string
    user_id?: string | null
    workout_id: number
    exercise_id: number
    weight?: number
    reps?: number
    distance?: number
    duration?: number
    rpe?: number
    position: number
    sub_sets?: string // JSON string
    created_at?: string
    updated_at?: string
    deleted_at?: string | null
    sync_status?: SyncStatus
    last_synced_at?: string | null
}

export interface SetData {
    weight?: number
    reps?: number
    distance?: number
    duration?: number
    sub_sets?: string // JSON string
}

export interface SetWithExerciseName extends Set {
    exercise_name: string
    // Raw taxonomy fields of the Set's Exercise; read them through
    // resolveExerciseMuscleGroup (ADR-0007).
    muscle_group: string | null
    primary_muscle: string | null
}

export type HistorySet = Set & { workout_date: string; workout_start: string }

export type SetSummaryRow = Pick<Set, 'workout_id' | 'exercise_id' | 'weight' | 'reps' | 'sub_sets' | 'position'> & {
    exercise_name: string
    exercise_type: Exercise['type']
    muscle_group: string | null
    primary_muscle: string | null
}

export const WorkoutRepository = {
    async create(date: string, templateUuid?: string | null): Promise<number> {
        return executeWrite(async (db) => {
            const now = nowIso()
            const result = await db.runAsync(
                `INSERT INTO workouts
                 (uuid, user_id, date, start_time, status, template_uuid, created_at, updated_at, sync_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                createEntityUuid(),
                getScopedUserId(),
                date,
                now,
                'in_progress',
                templateUuid ?? null,
                now,
                now,
                'dirty'
            )
            return result.lastInsertRowId
        })
    },

    async finish(id: number): Promise<void> {
        await executeWrite((db) => {
            const now = nowIso()
            const scope = buildPrincipalWhereClause('user_id')
            return db.runAsync(
                `UPDATE workouts
                 SET end_time = ?, status = ?, updated_at = ?, sync_status = ?
                 WHERE id = ? AND ${scope.clause}`,
                now,
                'finished',
                now,
                'dirty',
                id,
                ...scope.params
            )
        })
    },

    async delete(id: number): Promise<void> {
        await softDeleteById('workouts', 'workout', id)
    },

    async getById(id: number): Promise<Workout | null> {
        const db = await getDb()
        const scope = buildPrincipalWhereClause('user_id')
        const result = await db.getFirstAsync<Workout>(
            `SELECT * FROM workouts
             WHERE id = ? AND deleted_at IS NULL AND ${scope.clause}`,
            id,
            ...scope.params
        )
        return result ?? null
    },

    async getActiveWorkout(): Promise<Workout | null> {
        const db = await getDb()
        const scope = buildPrincipalWhereClause('user_id')
        const result = await db.getFirstAsync<Workout>(
            `SELECT * FROM workouts
             WHERE status = ? AND deleted_at IS NULL AND ${scope.clause}
             LIMIT 1`,
            'in_progress',
            ...scope.params
        )
        return result ?? null
    },

    async getAllWorkouts(): Promise<Workout[]> {
        const db = await getDb()
        const scope = buildPrincipalWhereClause('user_id')
        return await db.getAllAsync<Workout>(
            `SELECT * FROM workouts
             WHERE deleted_at IS NULL AND ${scope.clause}
             ORDER BY date DESC, start_time DESC`,
            ...scope.params
        )
    },

    async getWorkoutsForDate(date: string): Promise<Workout[]> {
        const db = await getDb()
        const scope = buildPrincipalWhereClause('user_id')
        return await db.getAllAsync<Workout>(
            `SELECT * FROM workouts
             WHERE date = ? AND deleted_at IS NULL AND ${scope.clause}`,
            date,
            ...scope.params
        )
    },

    async getWorkoutsForPeriod(startDate: string, endDate: string): Promise<Workout[]> {
        const db = await getDb()
        const scope = buildPrincipalWhereClause('user_id')
        return await db.getAllAsync<Workout>(
            `SELECT * FROM workouts
             WHERE date >= ? AND date <= ? AND deleted_at IS NULL AND ${scope.clause}
             ORDER BY date ASC`,
            startDate,
            endDate,
            ...scope.params
        )
    },

    async getRecentWorkouts(limit: number = 3): Promise<Workout[]> {
        const db = await getDb()
        const scope = buildPrincipalWhereClause('user_id')
        return await db.getAllAsync<Workout>(
            `SELECT * FROM workouts
             WHERE status = ? AND deleted_at IS NULL AND ${scope.clause}
             ORDER BY date DESC, start_time DESC LIMIT ?`,
            'finished',
            ...scope.params,
            limit
        )
    },

    async addSet(workoutId: number, exerciseId: number, data: SetData): Promise<void> {
        await executeWriteTransaction(async (db) => {
            const workoutScope = buildPrincipalWhereClause('w.user_id')
            const exerciseScope = buildPrincipalWhereClause('e.user_id')
            const setScope = buildPrincipalWhereClause('user_id')
            const targetWorkout = await db.getFirstAsync<{ id: number }>(
                `SELECT w.id
                 FROM workouts w
                 WHERE w.id = ? AND w.deleted_at IS NULL AND ${workoutScope.clause}
                 LIMIT 1`,
                workoutId,
                ...workoutScope.params
            )
            const targetExercise = await db.getFirstAsync<{ id: number }>(
                `SELECT e.id
                 FROM exercises e
                 WHERE e.id = ? AND e.deleted_at IS NULL AND ${exerciseScope.clause}
                 LIMIT 1`,
                exerciseId,
                ...exerciseScope.params
            )
            if (!targetWorkout?.id || !targetExercise?.id) {
                throw new Error('Cannot add set outside active principal scope.')
            }

            const lastSet = await db.getFirstAsync<{ position: number }>(
                `SELECT position FROM sets
                 WHERE workout_id = ? AND deleted_at IS NULL AND ${setScope.clause}
                 ORDER BY position DESC LIMIT 1`,
                workoutId,
                ...setScope.params
            )
            const nextPosition = resolveNextSetPosition(lastSet)
            const metrics = buildSetMetricColumns(data)
            const now = nowIso()

            await db.runAsync(
                `INSERT INTO sets
                 (uuid, user_id, workout_id, exercise_id, weight, reps, distance, duration, position, sub_sets, created_at, updated_at, sync_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                createEntityUuid(),
                getScopedUserId(),
                workoutId,
                exerciseId,
                metrics.weight,
                metrics.reps,
                metrics.distance,
                metrics.duration,
                nextPosition,
                metrics.sub_sets,
                now,
                now,
                'dirty'
            )
        })
    },

    async updateSet(setId: number, data: SetData): Promise<void> {
        const metrics = buildSetMetricColumns(data)
        await executeWrite((db) =>
            db.runAsync(
                `UPDATE sets
                 SET weight = ?, reps = ?, distance = ?, duration = ?, sub_sets = ?, updated_at = ?, sync_status = ?
                 WHERE id = ? AND ${buildPrincipalWhereClause('user_id').clause}`,
                metrics.weight,
                metrics.reps,
                metrics.distance,
                metrics.duration,
                metrics.sub_sets,
                nowIso(),
                'dirty',
                setId,
                ...buildPrincipalWhereClause('user_id').params
            )
        )
    },

    async deleteSet(setId: number): Promise<void> {
        await executeWriteTransaction(async (db) => {
            const setScope = buildPrincipalWhereClause('user_id')
            const entity = await db.getFirstAsync<{ uuid: string; user_id?: string | null }>(
                `SELECT uuid, user_id FROM sets WHERE id = ? AND ${setScope.clause}`,
                setId,
                ...setScope.params
            )
            if (entity?.uuid) {
                await recordDeletionTombstone(db, 'set', entity.uuid, entity.user_id)
            }
            await db.runAsync(`DELETE FROM sets WHERE id = ? AND ${setScope.clause}`, setId, ...setScope.params)
        })
    },

    // Sets of a deleted Exercise stay in the history: Exercises are only
    // soft-deleted, so the join still finds the row and its name.
    async getSets(workoutId: number): Promise<SetWithExerciseName[]> {
        const db = await getDb()
        const setScope = buildPrincipalWhereClause('s.user_id')
        const exerciseScope = buildPrincipalWhereClause('e.user_id')
        const workoutScope = buildPrincipalWhereClause('w.user_id')
        return await db.getAllAsync<SetWithExerciseName>(
            `SELECT s.*, e.name as exercise_name, e.muscle_group as muscle_group, e.primary_muscle as primary_muscle
             FROM sets s
             JOIN exercises e ON s.exercise_id = e.id
             JOIN workouts w ON s.workout_id = w.id
             WHERE s.workout_id = ?
               AND s.deleted_at IS NULL
               AND w.deleted_at IS NULL
               AND ${setScope.clause}
               AND ${exerciseScope.clause}
               AND ${workoutScope.clause}
             ORDER BY s.position ASC, s.id ASC`,
            workoutId,
            ...setScope.params,
            ...exerciseScope.params,
            ...workoutScope.params
        )
    },

    // The Exercises this Workout has Sets of, deleted ones included, so a Set
    // of a since-deleted Exercise can still be edited.
    async getSetExercises(workoutId: number): Promise<Exercise[]> {
        const db = await getDb()
        const setScope = buildPrincipalWhereClause('s.user_id')
        const exerciseScope = buildPrincipalWhereClause('e.user_id')
        return await db.getAllAsync<Exercise>(
            `SELECT DISTINCT e.*
             FROM exercises e
             JOIN sets s ON s.exercise_id = e.id
             WHERE s.workout_id = ?
               AND s.deleted_at IS NULL
               AND ${setScope.clause}
               AND ${exerciseScope.clause}`,
            workoutId,
            ...setScope.params,
            ...exerciseScope.params
        )
    },

    // Every Set of the given Exercises from finished Workouts other than
    // `excludeWorkoutId`, with its Workout's date and start, for previous
    // performance and personal records. Deleted Exercises still count.
    async getFinishedExerciseSets(exerciseIds: readonly number[], excludeWorkoutId: number): Promise<HistorySet[]> {
        if (exerciseIds.length === 0) return []
        const db = await getDb()
        const setScope = buildPrincipalWhereClause('s.user_id')
        const workoutScope = buildPrincipalWhereClause('w.user_id')
        const placeholders = exerciseIds.map(() => '?').join(',')
        return await db.getAllAsync<HistorySet>(
            `SELECT s.*, w.date as workout_date, w.start_time as workout_start
             FROM sets s
             JOIN workouts w ON s.workout_id = w.id
             WHERE s.exercise_id IN (${placeholders})
               AND w.id != ?
               AND w.status = 'finished'
               AND s.deleted_at IS NULL
               AND w.deleted_at IS NULL
               AND ${setScope.clause}
               AND ${workoutScope.clause}`,
            ...exerciseIds,
            excludeWorkoutId,
            ...setScope.params,
            ...workoutScope.params
        )
    },

    // One light row per live Set of every live Workout, with its Exercise's
    // name, type and primary Muscle, so the history list and its stats are
    // summarized in one read instead of one query per Workout.
    async getAllSetRows(): Promise<SetSummaryRow[]> {
        const db = await getDb()
        const setScope = buildPrincipalWhereClause('s.user_id')
        const workoutScope = buildPrincipalWhereClause('w.user_id')
        return await db.getAllAsync<SetSummaryRow>(
            `SELECT s.workout_id, s.exercise_id, s.weight, s.reps, s.sub_sets, s.position,
                    e.name as exercise_name, e.type as exercise_type,
                    e.muscle_group as muscle_group, e.primary_muscle as primary_muscle
             FROM sets s
             JOIN exercises e ON s.exercise_id = e.id
             JOIN workouts w ON s.workout_id = w.id
             WHERE s.deleted_at IS NULL
               AND w.deleted_at IS NULL
               AND ${setScope.clause}
               AND ${workoutScope.clause}
             ORDER BY s.workout_id, s.position ASC, s.id ASC`,
            ...setScope.params,
            ...workoutScope.params
        )
    },

    async getWorkoutCountForMonth(month: string): Promise<number> {
        // month: YYYY-MM
        const db = await getDb()
        const scope = buildPrincipalWhereClause('user_id')
        const result = await db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count
             FROM workouts
             WHERE date LIKE ?
               AND status = 'finished'
               AND deleted_at IS NULL
               AND ${scope.clause}`,
            `${month}%`,
            ...scope.params
        )
        return result?.count ?? 0
    },

    async getAvgWorkoutDuration(month: string): Promise<number> {
        const db = await getDb()
        const scope = buildPrincipalWhereClause('user_id')
        const result = await db.getFirstAsync<{ avg_duration: number }>(
            `SELECT AVG(unix_duration) as avg_duration
             FROM (
                SELECT (strftime('%s', end_time) - strftime('%s', start_time)) / 60 as unix_duration
                FROM workouts
                WHERE date LIKE ?
                  AND status = 'finished'
                  AND end_time IS NOT NULL
                  AND deleted_at IS NULL
                  AND ${scope.clause}
             )`,
            `${month}%`,
            ...scope.params
        )
        return result?.avg_duration ?? 0
    },

    async updateTiming(id: number, date: string, startTime: string, endTime?: string): Promise<void> {
        const scope = buildPrincipalWhereClause('user_id')
        await executeWrite((db) =>
            db.runAsync(
                `UPDATE workouts
                 SET date = ?, start_time = ?, end_time = ?, updated_at = ?, sync_status = ?
                 WHERE id = ? AND ${scope.clause}`,
                date,
                startTime,
                endTime ?? null,
                nowIso(),
                'dirty',
                id,
                ...scope.params
            )
        )
    },
}
