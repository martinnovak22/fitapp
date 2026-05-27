import type { ExerciseType } from '@/src/db/exercises'
import type { Set } from '@/src/db/workouts'
import { formatDuration } from '@/src/utils/formatters'

export type PrimaryMetric = 'weight' | 'reps' | 'distance' | 'duration'
export type SecondaryMetric = PrimaryMetric | null
export type MetricUnit = 'kg' | 'reps' | 'm' | ''

export interface ExerciseTypeAdapter {
    primaryMetric: PrimaryMetric
    secondaryMetric: SecondaryMetric
    unit: MetricUnit
    format: (value: number) => string
    bestSetComparator: (a: Set, b: Set) => number
}

// Comparator returns negative when `a` is better, positive when `b` is better,
// matching Array.sort semantics — callers can `sets.sort(cmp)[0]` for "best."
const formatNumeric = (decimals: number) => (value: number) => value.toFixed(decimals)
const formatInteger = (value: number) => Math.round(value).toString()

const compareBy = (
    a: Set,
    b: Set,
    primary: (s: Set) => number,
    secondary?: (s: Set) => number
): number => {
    const pa = primary(a)
    const pb = primary(b)
    if (pa !== pb) return pb - pa
    if (secondary) {
        const sa = secondary(a)
        const sb = secondary(b)
        if (sa !== sb) return sb - sa
    }
    return 0
}

const weightAdapter: ExerciseTypeAdapter = {
    primaryMetric: 'weight',
    secondaryMetric: 'reps',
    unit: 'kg',
    format: formatNumeric(2),
    bestSetComparator: (a, b) =>
        compareBy(
            a,
            b,
            (s) => s.weight ?? 0,
            (s) => s.reps ?? 0
        ),
}

const bodyweightAdapter: ExerciseTypeAdapter = {
    primaryMetric: 'reps',
    secondaryMetric: null,
    unit: 'reps',
    format: formatInteger,
    bestSetComparator: (a, b) => compareBy(a, b, (s) => s.reps ?? 0),
}

const bodyweightTimerAdapter: ExerciseTypeAdapter = {
    primaryMetric: 'duration',
    secondaryMetric: null,
    unit: '',
    format: formatDuration,
    bestSetComparator: (a, b) => compareBy(a, b, (s) => s.duration ?? 0),
}

const cardioAdapter: ExerciseTypeAdapter = {
    primaryMetric: 'distance',
    secondaryMetric: 'duration',
    unit: 'm',
    format: formatNumeric(2),
    bestSetComparator: (a, b) =>
        compareBy(
            a,
            b,
            (s) => s.distance ?? 0,
            (s) => s.duration ?? 0
        ),
}

const adapters: Record<ExerciseType, ExerciseTypeAdapter> = {
    weight: weightAdapter,
    bodyweight: bodyweightAdapter,
    bodyweight_timer: bodyweightTimerAdapter,
    cardio: cardioAdapter,
}

export const ExerciseTypeMetadata = {
    for(type: ExerciseType): ExerciseTypeAdapter {
        return adapters[type]
    },
}

export const getSetMetricValue = (set: Set, metric: PrimaryMetric): number => {
    switch (metric) {
        case 'weight':
            return set.weight ?? 0
        case 'reps':
            return set.reps ?? 0
        case 'distance':
            return set.distance ?? 0
        case 'duration':
            return set.duration ?? 0
    }
}
