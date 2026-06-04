import type { ExerciseType } from '@/src/db/exercises'
import type { Set } from '@/src/db/workouts'
import { formatDuration } from '@/src/utils/formatters'

export type PrimaryMetric = 'weight' | 'reps' | 'distance' | 'duration'
type MetricUnit = 'kg' | 'reps' | 'm' | ''

const formatCompactWeight = (value: number): string => {
    const rounded = Math.round(value * 100) / 100
    return rounded.toString()
}

// Signed compact weight for the bodyweight context suffix: vest shows `+10`,
// assistance shows `-20`. Caller drops this entirely when weight is zero.
const formatSignedWeight = (value: number): string => {
    const compact = formatCompactWeight(Math.abs(value))
    return value < 0 ? `-${compact}` : `+${compact}`
}

const formatCompactDistance = (meters: number): string =>
    meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.round(meters)}m`

const metricUnit: Record<PrimaryMetric, MetricUnit> = {
    weight: 'kg',
    reps: 'reps',
    distance: 'm',
    duration: '',
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

// "Better is lower" only for cardio when the dominant metric is duration:
// the run is at a fixed distance, so the fastest time wins.
const betterIsLower = (type: ExerciseType, dominant: PrimaryMetric): boolean =>
    type === 'cardio' && dominant === 'duration'

const compareMetric = (type: ExerciseType, dominant: PrimaryMetric, a: number, b: number): number =>
    betterIsLower(type, dominant) ? a - b : b - a

const tiebreakerFor = (type: ExerciseType, dominant: PrimaryMetric): PrimaryMetric | null => {
    if (dominant === 'weight') {
        return type === 'bodyweight_timer' ? 'duration' : 'reps'
    }
    if (type === 'cardio' && dominant === 'distance') return 'duration'
    return null
}

export const bestSetComparatorFor = (type: ExerciseType, dominant: PrimaryMetric): ((a: Set, b: Set) => number) => {
    const secondary = tiebreakerFor(type, dominant)
    return (a, b) => {
        const primary = compareMetric(type, dominant, getSetMetricValue(a, dominant), getSetMetricValue(b, dominant))
        if (primary !== 0) return primary
        if (!secondary) return 0
        // Tiebreakers always reward larger values (more reps, longer duration when at the
        // same weight, longer duration when at the same distance).
        return getSetMetricValue(b, secondary) - getSetMetricValue(a, secondary)
    }
}

const formatRawMetric = (metric: PrimaryMetric, value: number): string => {
    switch (metric) {
        case 'weight':
            return value.toFixed(2)
        case 'reps':
            return Math.round(value).toString()
        case 'distance':
            return value.toFixed(2)
        case 'duration':
            return formatDuration(value)
    }
}

// Compact, single-string label that captures the whole set for one data point.
// Driven by (exercise type, dominant metric) per the PRD's table.
export const formatCompactSetLabel = (type: ExerciseType, _dominant: PrimaryMetric, set: Set): string => {
    const weight = set.weight ?? 0
    const reps = set.reps ?? 0
    const distance = set.distance ?? 0
    const duration = set.duration ?? 0

    switch (type) {
        case 'weight':
            return `${formatCompactWeight(weight)}×${Math.round(reps)}`
        case 'bodyweight':
            return weight === 0 ? `${Math.round(reps)}` : `${Math.round(reps)} (${formatSignedWeight(weight)})`
        case 'bodyweight_timer':
            return weight === 0
                ? formatDuration(duration)
                : `${formatDuration(duration)} (${formatSignedWeight(weight)})`
        case 'cardio':
            return `${formatCompactDistance(distance)}·${formatDuration(duration)}`
    }
}

// Headline string for the picker / personal-best card. Single dominant value with its unit.
export const formatHeadlineStat = (_type: ExerciseType, dominant: PrimaryMetric, value: number): string => {
    if (dominant === 'distance') return formatCompactDistance(value)
    if (dominant === 'duration') return formatDuration(value)
    const unit = metricUnit[dominant]
    const formatted = formatRawMetric(dominant, value)
    return unit ? `${formatted} ${unit}` : formatted
}

const formatAxisLabel = (dominant: PrimaryMetric, value: number): string => {
    switch (dominant) {
        case 'weight':
            return value.toFixed(0)
        case 'reps':
            return Math.round(value).toString()
        case 'distance':
            return formatCompactDistance(value)
        case 'duration':
            return formatDuration(value)
    }
}

interface ExerciseTypeAdapter {
    type: ExerciseType
    defaultDominantMetric: PrimaryMetric
}

const defaultDominantByType: Record<ExerciseType, PrimaryMetric> = {
    weight: 'weight',
    bodyweight: 'reps',
    bodyweight_timer: 'duration',
    cardio: 'distance',
}

export const ExerciseTypeMetadata = {
    for(type: ExerciseType): ExerciseTypeAdapter {
        return { type, defaultDominantMetric: defaultDominantByType[type] }
    },
    defaultDominantMetric(type: ExerciseType): PrimaryMetric {
        return defaultDominantByType[type]
    },
    bestSetComparator(type: ExerciseType, dominant: PrimaryMetric) {
        return bestSetComparatorFor(type, dominant)
    },
    formatCompactSetLabel,
    formatHeadlineStat,
    formatAxisLabel,
    isBetterLower(type: ExerciseType, dominant: PrimaryMetric): boolean {
        return betterIsLower(type, dominant)
    },
}
