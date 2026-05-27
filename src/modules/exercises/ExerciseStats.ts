import { buildPrincipalWhereClause } from '@/src/data/principal'
import { getDb } from '@/src/db/client'
import { type Exercise, ExerciseRepository, type ExerciseType } from '@/src/db/exercises'
import type { Set } from '@/src/db/workouts'
import { ExerciseTypeMetadata, getSetMetricValue } from './ExerciseTypeMetadata'

export interface BestSetEntry {
    date: string
    set: Set
}

export interface HeadlineStat {
    value: number
    formatted: string
}

const fetchExerciseType = async (exerciseId: number): Promise<ExerciseType | null> => {
    const exercise = await ExerciseRepository.getById(exerciseId)
    return exercise?.type ?? null
}

const fetchScopedSets = async (
    exerciseId: number
): Promise<{ set: Set; date: string }[]> => {
    const db = await getDb()
    const setScope = buildPrincipalWhereClause('s.user_id')
    const workoutScope = buildPrincipalWhereClause('w.user_id')
    const rows = await db.getAllAsync<Set & { workout_date: string }>(
        `SELECT s.*, w.date as workout_date
         FROM sets s
         JOIN workouts w ON s.workout_id = w.id
         WHERE s.exercise_id = ?
           AND w.status = 'finished'
           AND s.deleted_at IS NULL
           AND w.deleted_at IS NULL
           AND ${setScope.clause}
           AND ${workoutScope.clause}`,
        exerciseId,
        ...setScope.params,
        ...workoutScope.params
    )
    return rows.map(({ workout_date, ...set }) => ({ set: set as Set, date: workout_date }))
}

export const ExerciseStats = {
    async bestSetPerSession(exerciseId: number): Promise<BestSetEntry[]> {
        const type = await fetchExerciseType(exerciseId)
        if (!type) return []

        const comparator = ExerciseTypeMetadata.for(type).bestSetComparator
        const rows = await fetchScopedSets(exerciseId)

        const bestByDate = new Map<string, Set>()
        for (const { set, date } of rows) {
            const incumbent = bestByDate.get(date)
            if (!incumbent || comparator(set, incumbent) < 0) {
                bestByDate.set(date, set)
            }
        }

        return Array.from(bestByDate.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, set]) => ({ date, set }))
    },

    async headlineStats(exercises: Exercise[]): Promise<Map<number, HeadlineStat | null>> {
        const result = new Map<number, HeadlineStat | null>()
        for (const exercise of exercises) result.set(exercise.id, null)
        if (exercises.length === 0) return result

        const db = await getDb()
        const setScope = buildPrincipalWhereClause('s.user_id')
        const workoutScope = buildPrincipalWhereClause('w.user_id')
        const placeholders = exercises.map(() => '?').join(',')
        const rows = await db.getAllAsync<Set>(
            `SELECT s.*
             FROM sets s
             JOIN workouts w ON s.workout_id = w.id
             WHERE s.exercise_id IN (${placeholders})
               AND w.status = 'finished'
               AND s.deleted_at IS NULL
               AND w.deleted_at IS NULL
               AND ${setScope.clause}
               AND ${workoutScope.clause}`,
            ...exercises.map((e) => e.id),
            ...setScope.params,
            ...workoutScope.params
        )

        const byExercise = new Map<number, Set>()
        const adapterByExercise = new Map<number, ReturnType<typeof ExerciseTypeMetadata.for>>()
        for (const exercise of exercises) {
            adapterByExercise.set(exercise.id, ExerciseTypeMetadata.for(exercise.type))
        }

        for (const set of rows) {
            const adapter = adapterByExercise.get(set.exercise_id)
            if (!adapter) continue
            const incumbent = byExercise.get(set.exercise_id)
            if (!incumbent || adapter.bestSetComparator(set, incumbent) < 0) {
                byExercise.set(set.exercise_id, set)
            }
        }

        for (const exercise of exercises) {
            const best = byExercise.get(exercise.id)
            if (!best) continue
            const adapter = ExerciseTypeMetadata.for(exercise.type)
            const value = getSetMetricValue(best, adapter.primaryMetric)
            const formatted = adapter.unit
                ? `${adapter.format(value)} ${adapter.unit}`
                : adapter.format(value)
            result.set(exercise.id, { value, formatted })
        }

        return result
    },
}
