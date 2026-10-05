import { buildPrincipalWhereClause } from '@/src/data/principal'
import { getDb } from '@/src/db/client'
import { ExerciseRepository, type ExerciseType } from '@/src/db/exercises'
// biome-ignore lint/suspicious/noShadowRestrictedNames: domain model, not JS Set
import type { Set } from '@/src/db/workouts'
import { bestSetComparatorFor, type PrimaryMetric } from './ExerciseTypeMetadata'

export interface BestSetEntry {
    date: string
    set: Set
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
}
