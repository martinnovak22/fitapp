// Pure rules behind the History tab: what each Workout row says (sets, volume,
// top exercises), how the list groups by month, and the weekly totals on the
// stats view. Fed by WorkoutRepository.getAllSetRows in one read.

import type { SetSummaryRow, Workout } from '@/src/db/workouts'
import { getWeekStart } from '@/src/modules/workout/weekSummary'
import { parseSubSets } from '@/src/modules/workout/workoutUtils'
import { formatLocalDateYYYYMMDD, parseLocalDate } from '@/src/utils/dateTime'

export type WorkoutRowSummary = {
    setCount: number
    // weight × reps of weight-type Sets, drop stages included (owner decision:
    // bodyweight is not counted because body weight is not stored).
    volumeKg: number
    // Up to three Exercise names, most sets first, ties in the order done.
    topExercises: string[]
}

const TOP_EXERCISES = 3

const setVolume = (row: SetSummaryRow): number => {
    if (row.exercise_type !== 'weight') return 0
    const main = (row.weight ?? 0) * (row.reps ?? 0)
    return main + parseSubSets(row.sub_sets).reduce((sum, sub) => sum + (sub.weight ?? 0) * (sub.reps ?? 0), 0)
}

export const summarizeWorkoutSets = (rows: readonly SetSummaryRow[]): Map<number, WorkoutRowSummary> => {
    const byWorkout = new Map<number, SetSummaryRow[]>()
    for (const row of rows) byWorkout.set(row.workout_id, [...(byWorkout.get(row.workout_id) ?? []), row])

    const result = new Map<number, WorkoutRowSummary>()
    for (const [workoutId, sets] of byWorkout) {
        const counts = new Map<string, { count: number; first: number }>()
        sets.forEach((set, index) => {
            const entry = counts.get(set.exercise_name)
            if (entry) entry.count += 1
            else counts.set(set.exercise_name, { count: 1, first: index })
        })
        const topExercises = [...counts.entries()]
            .sort(([, a], [, b]) => b.count - a.count || a.first - b.first)
            .slice(0, TOP_EXERCISES)
            .map(([name]) => name)
        result.set(workoutId, {
            setCount: sets.length,
            volumeKg: sets.reduce((sum, set) => sum + setVolume(set), 0),
            topExercises,
        })
    }
    return result
}

export type MonthSection<W> = { key: string; month: Date; data: W[] }

// Consecutive Workouts of one calendar month form a section, keeping the
// caller's order (newest first).
export const groupByMonth = <W extends Pick<Workout, 'date'>>(workouts: readonly W[]): MonthSection<W>[] => {
    const sections: MonthSection<W>[] = []
    for (const workout of workouts) {
        const key = workout.date.slice(0, 7)
        const last = sections.at(-1)
        if (last && last.key === key) last.data.push(workout)
        else sections.push({ key, month: parseLocalDate(`${key}-01`), data: [workout] })
    }
    return sections
}

export type WeekTotal = { weekStart: Date; workouts: number; volumeKg: number }

// The last `weeks` weeks (Monday first), oldest to newest, this week included.
export const weeklyTotals = (
    finished: readonly Pick<Workout, 'id' | 'date'>[],
    summaries: ReadonlyMap<number, WorkoutRowSummary>,
    today: Date,
    weeks = 8
): WeekTotal[] => {
    const current = getWeekStart(today)
    const totals: WeekTotal[] = Array.from({ length: weeks }, (_, index) => {
        const weekStart = new Date(current)
        weekStart.setDate(current.getDate() - (weeks - 1 - index) * 7)
        return { weekStart, workouts: 0, volumeKg: 0 }
    })
    const indexByWeek = new Map(totals.map((total, index) => [formatLocalDateYYYYMMDD(total.weekStart), index]))
    for (const workout of finished) {
        const index = indexByWeek.get(formatLocalDateYYYYMMDD(getWeekStart(parseLocalDate(workout.date))))
        if (index === undefined) continue
        totals[index].workouts += 1
        totals[index].volumeKg += summaries.get(workout.id)?.volumeKg ?? 0
    }
    return totals
}

// Sets of Workouts on or after `fromDate` (YYYY-MM-DD), for a period's muscle balance.
export const setsSince = (
    rows: readonly SetSummaryRow[],
    workouts: readonly Pick<Workout, 'id' | 'date'>[],
    fromDate: string
): SetSummaryRow[] => {
    const inRange = new Set(workouts.filter((workout) => workout.date >= fromDate).map((workout) => workout.id))
    return rows.filter((row) => inRange.has(row.workout_id))
}
