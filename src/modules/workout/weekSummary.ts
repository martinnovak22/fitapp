// Pure rules behind the Workout tab's week strip: which days of this week have
// a Workout, how many there were, and how many weeks in a row had at least one.
// Weeks start on Monday (cs and en-GB convention).

import type { Workout } from '@/src/db/workouts'
import { formatLocalDateYYYYMMDD } from '@/src/utils/dateTime'

/** Parse a YYYY-MM-DD string as a local-time date (new Date(str) would parse it as UTC). */
export const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
}

/** Monday 00:00 of the week containing the given date. */
export const getWeekStart = (value: Date): Date => {
    const d = new Date(value)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d
}

export const workoutMinutes = (workout: Pick<Workout, 'start_time' | 'end_time'>): number => {
    if (!workout.end_time) return 0
    return Math.max(
        0,
        Math.round((new Date(workout.end_time).getTime() - new Date(workout.start_time).getTime()) / 60000)
    )
}

export type WeekDay = {
    date: string
    // The day's own Date, for locale-aware weekday labels.
    day: Date
    workedOut: boolean
    isToday: boolean
    // Minutes trained that day across finished Workouts.
    minutes: number
}

export type WeekSummary = {
    days: WeekDay[]
    // Days of this week with at least one Workout (finished or running).
    workoutDays: number
    totalMinutes: number
    // Consecutive weeks with a finished Workout, ending this week or, if this
    // week has none yet, last week: an untrained current week doesn't break it.
    streakWeeks: number
}

export const summarizeWeek = (
    finished: readonly Pick<Workout, 'date' | 'start_time' | 'end_time'>[],
    active: Pick<Workout, 'date'> | null,
    today: Date
): WeekSummary => {
    const weekStart = getWeekStart(today)
    const todayStr = formatLocalDateYYYYMMDD(today)
    const dates = new Set(finished.map((workout) => workout.date))
    if (active) dates.add(active.date)
    const minutesByDate = new Map<string, number>()
    for (const workout of finished) {
        minutesByDate.set(workout.date, (minutesByDate.get(workout.date) ?? 0) + workoutMinutes(workout))
    }

    const days: WeekDay[] = Array.from({ length: 7 }, (_, index) => {
        const day = new Date(weekStart)
        day.setDate(weekStart.getDate() + index)
        const date = formatLocalDateYYYYMMDD(day)
        return {
            date,
            day,
            workedOut: dates.has(date),
            isToday: date === todayStr,
            minutes: minutesByDate.get(date) ?? 0,
        }
    })

    const trainedWeeks = new Set(
        finished.map((workout) => formatLocalDateYYYYMMDD(getWeekStart(parseLocalDate(workout.date))))
    )
    const cursor = new Date(weekStart)
    if (!trainedWeeks.has(formatLocalDateYYYYMMDD(cursor))) cursor.setDate(cursor.getDate() - 7)
    let streakWeeks = 0
    while (trainedWeeks.has(formatLocalDateYYYYMMDD(cursor))) {
        streakWeeks++
        cursor.setDate(cursor.getDate() - 7)
    }

    return {
        days,
        workoutDays: days.filter((day) => day.workedOut).length,
        totalMinutes: days.reduce((sum, day) => sum + day.minutes, 0),
        streakWeeks,
    }
}
