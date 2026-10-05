// Pure rules behind the exercise detail: the personal record, the estimated
// one-rep max, the chart's time range and points. The best Set per Workout
// comes from ExerciseStats.bestSetPerSession.

import type { ExerciseType } from '@/src/db/exercises'
// biome-ignore lint/suspicious/noShadowRestrictedNames: domain model, not JS Set
import type { Set } from '@/src/db/workouts'
import { parseLocalDate } from '@/src/utils/dateTime'
import type { BestSetEntry } from './ExerciseStats'
import {
    bestSetComparatorFor,
    ExerciseTypeMetadata,
    getSetMetricValue,
    type PrimaryMetric,
} from './ExerciseTypeMetadata'

// Above this many reps an estimate says more about endurance than strength,
// so none is given (the limit Strong uses for its predictions).
const MAX_REPS_FOR_ESTIMATE = 12

// Epley: weight × (1 + reps / 30). A single is its own one-rep max.
export const estimateOneRepMax = (weight: number | undefined, reps: number | undefined): number | null => {
    if (!weight || !reps || weight <= 0 || reps <= 0 || reps > MAX_REPS_FOR_ESTIMATE) return null
    return reps === 1 ? weight : weight * (1 + reps / 30)
}

export type HistoryRange = '1m' | '3m' | '1y' | 'all'

const RANGE_DAYS: Record<Exclude<HistoryRange, 'all'>, number> = { '1m': 31, '3m': 92, '1y': 366 }

export const filterByRange = <E extends { date: string }>(
    entries: readonly E[],
    range: HistoryRange,
    today: Date
): E[] => {
    if (range === 'all') return [...entries]
    const from = new Date(today)
    from.setHours(0, 0, 0, 0)
    from.setDate(from.getDate() - RANGE_DAYS[range])
    return entries.filter((entry) => parseLocalDate(entry.date) >= from)
}

export type PersonalRecord = {
    entry: BestSetEntry
    // Weight exercises only, when the record set has 12 reps or fewer.
    estimatedOneRepMax: number | null
}

// The best Workout ever by the type's PrimaryMetric (ties: the earlier one).
export const personalRecord = (type: ExerciseType, entries: readonly BestSetEntry[]): PersonalRecord | null => {
    if (entries.length === 0) return null
    const comparator = bestSetComparatorFor(type, ExerciseTypeMetadata.defaultDominantMetric(type))
    const best = entries.reduce((acc, entry) => (comparator(entry.set, acc.set) < 0 ? entry : acc))
    return {
        entry: best,
        estimatedOneRepMax: type === 'weight' ? estimateOneRepMax(best.set.weight, best.set.reps) : null,
    }
}

// What the chart plots: the Workout's best Set by the PrimaryMetric, or its
// estimated one-rep max for weight exercises.
export type ChartMetric = 'best' | 'oneRepMax'

export type ChartPoint = { date: string; value: number; set: Set }

export const chartPoints = (
    entries: readonly BestSetEntry[],
    metric: ChartMetric,
    dominant: PrimaryMetric
): ChartPoint[] =>
    entries.flatMap(({ date, set }) => {
        if (metric === 'oneRepMax') {
            const estimate = estimateOneRepMax(set.weight, set.reps)
            return estimate === null ? [] : [{ date, value: estimate, set }]
        }
        return [{ date, value: getSetMetricValue(set, dominant), set }]
    })

export const AXIS_SECTIONS = 4

const STEP_MULTIPLIERS = [1, 2, 2.5, 5]

// The smallest 1–2–2.5–5 step that is at least rawStep.
const niceStep = (rawStep: number) => {
    const power = 10 ** Math.floor(Math.log10(rawStep))
    return STEP_MULTIPLIERS.map((m) => m * power).find((candidate) => candidate >= rawStep) ?? 10 * power
}

const nextNiceStep = (step: number) => niceStep(step * 1.0001)

// The axis hugs the data instead of starting at zero, so a few kilos of
// progress read as a climb: 4 sections on a 1–2–2.5–5 step, starting a step
// below the lowest value when that still reaches the highest one. When the
// rounded-down start leaves the top short, the step grows until it fits.
export const fitAxis = (values: readonly number[]) => {
    if (values.length === 0 || !values.every(Number.isFinite))
        return { offset: 0, stepValue: 1, maxValue: AXIS_SECTIONS }
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || Math.max(Math.abs(max) * 0.2, 1)
    let stepValue = niceStep(span / (AXIS_SECTIONS - 1))
    for (;;) {
        const floor = Math.floor(min / stepValue) * stepValue
        const reaches = (offset: number) => offset + stepValue * AXIS_SECTIONS >= max
        const padded = Math.max(0, floor - stepValue)
        if (reaches(padded)) return { offset: padded, stepValue, maxValue: stepValue * AXIS_SECTIONS }
        if (reaches(floor)) return { offset: floor, stepValue, maxValue: stepValue * AXIS_SECTIONS }
        stepValue = nextNiceStep(stepValue)
    }
}
