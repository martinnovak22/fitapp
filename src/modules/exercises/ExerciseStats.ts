import { buildPrincipalWhereClause } from '@/src/data/principal'
import { getDb } from '@/src/db/client'
import { type Exercise, ExerciseRepository, type ExerciseType } from '@/src/db/exercises'
// biome-ignore lint/suspicious/noShadowRestrictedNames: domain model, not JS Set
import type { Set } from '@/src/db/workouts'
import {
    bestSetComparatorFor,
    ExerciseTypeMetadata,
    formatHeadlineStat,
    getSetMetricValue,
    type PrimaryMetric,
} from './ExerciseTypeMetadata'

export interface BestSetEntry {
    date: string
    set: Set
}

export interface HeadlineStat {
    value: number
    formatted: string
}

export interface SessionSummary {
    dominantMetric: PrimaryMetric
    max: number
    avg: number
    // For cardio when duration is dominant we expose the held-constant context
    // (avg distance across sessions) so the graph header can label it.
    contextAvgDistance?: number
}

const coefficientOfVariation = (values: number[]): number => {
    if (values.length === 0) return 0
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    if (mean === 0) return 0
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
    return Math.sqrt(variance) / mean
}

const computeDominantMetric = (
    type: ExerciseType,
    sets: Pick<Set, 'weight' | 'reps' | 'distance' | 'duration'>[]
): PrimaryMetric => {
    switch (type) {
        case 'weight':
            return 'weight'
        case 'bodyweight':
            // Reps is always the main axis for bodyweight; any added load (vest = +,
            // assistance = -) rides along as context on the label, never drives Y.
            return 'reps'
        case 'bodyweight_timer':
            return 'duration'
        case 'cardio': {
            const distances = sets.map((s) => s.distance ?? 0)
            const durations = sets.map((s) => s.duration ?? 0)
            return coefficientOfVariation(durations) > coefficientOfVariation(distances) ? 'duration' : 'distance'
        }
    }
}

const fetchExerciseType = async (exerciseId: number): Promise<ExerciseType | null> => {
    const exercise = await ExerciseRepository.getById(exerciseId)
    return exercise?.type ?? null
}

const fetchScopedSets = async (exerciseId: number): Promise<{ set: Set; date: string }[]> => {
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

interface ExerciseHistory {
    type: ExerciseType
    dominantMetric: PrimaryMetric
    bestByDate: Map<string, Set>
}

const collectHistory = async (exerciseId: number): Promise<ExerciseHistory | null> => {
    const type = await fetchExerciseType(exerciseId)
    if (!type) return null
    const rows = await fetchScopedSets(exerciseId)
    const dominantMetric = computeDominantMetric(
        type,
        rows.map((r) => r.set)
    )
    const comparator = bestSetComparatorFor(type, dominantMetric)
    const bestByDate = new Map<string, Set>()
    for (const { set, date } of rows) {
        const incumbent = bestByDate.get(date)
        if (!incumbent || comparator(set, incumbent) < 0) {
            bestByDate.set(date, set)
        }
    }
    return { type, dominantMetric, bestByDate }
}

export const ExerciseStats = {
    async dominantMetric(exerciseId: number): Promise<PrimaryMetric | null> {
        const history = await collectHistory(exerciseId)
        return history?.dominantMetric ?? null
    },

    async bestSetPerSession(exerciseId: number): Promise<BestSetEntry[]> {
        const history = await collectHistory(exerciseId)
        if (!history) return []
        return Array.from(history.bestByDate.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, set]) => ({ date, set }))
    },

    async sessionSummary(exerciseId: number): Promise<SessionSummary | null> {
        const history = await collectHistory(exerciseId)
        if (!history || history.bestByDate.size === 0) return null
        const { type, dominantMetric, bestByDate } = history

        const bestSets = Array.from(bestByDate.values())
        const values = bestSets.map((s) => getSetMetricValue(s, dominantMetric))
        const sum = values.reduce((a, b) => a + b, 0)
        // For duration-dominant cardio, "best" is the shortest time.
        const max = ExerciseTypeMetadata.isBetterLower(type, dominantMetric) ? Math.min(...values) : Math.max(...values)
        const summary: SessionSummary = {
            dominantMetric,
            max,
            avg: sum / values.length,
        }
        if (type === 'cardio' && dominantMetric === 'duration') {
            const distances = bestSets.map((s) => s.distance ?? 0)
            summary.contextAvgDistance = distances.reduce((a, b) => a + b, 0) / distances.length
        }
        return summary
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

        const setsByExercise = new Map<number, Set[]>()
        for (const exercise of exercises) setsByExercise.set(exercise.id, [])
        for (const set of rows) setsByExercise.get(set.exercise_id)?.push(set)

        for (const exercise of exercises) {
            const exerciseSets = setsByExercise.get(exercise.id) ?? []
            if (exerciseSets.length === 0) continue
            const dominantMetric = computeDominantMetric(exercise.type, exerciseSets)
            const comparator = bestSetComparatorFor(exercise.type, dominantMetric)
            const best = exerciseSets.reduce((acc, s) => (comparator(s, acc) < 0 ? s : acc))
            const value = getSetMetricValue(best, dominantMetric)
            const formatted = formatHeadlineStat(exercise.type, dominantMetric, value)
            result.set(exercise.id, { value, formatted })
        }

        return result
    },
}
