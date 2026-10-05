import { describe, expect, it } from 'vitest'
import { getWeekStart, summarizeWeek, workoutMinutes } from '../weekSummary'

// Wednesday 7 October 2026, local time.
const TODAY = new Date(2026, 9, 7, 15, 30)

describe('getWeekStart', () => {
    it('starts the week on Monday, also from a Sunday', () => {
        expect(getWeekStart(TODAY).getDate()).toBe(5)
        expect(getWeekStart(new Date(2026, 9, 11)).getDate()).toBe(5)
    })
})

describe('summarizeWeek', () => {
    it('marks workout days and today, counting a running workout', () => {
        const summary = summarizeWeek(
            [{ start_time: '2026-01-01T10:00:00Z', date: '2026-10-05' }],
            { date: '2026-10-07' },
            TODAY
        )
        expect(summary.days.map((d) => d.date)).toEqual([
            '2026-10-05',
            '2026-10-06',
            '2026-10-07',
            '2026-10-08',
            '2026-10-09',
            '2026-10-10',
            '2026-10-11',
        ])
        expect(summary.days.map((d) => d.workedOut)).toEqual([true, false, true, false, false, false, false])
        expect(summary.days.findIndex((d) => d.isToday)).toBe(2)
        expect(summary.workoutDays).toBe(2)
    })

    it('sums minutes per day and for the week, finished workouts only', () => {
        const summary = summarizeWeek(
            [
                { date: '2026-10-05', start_time: '2026-10-05T10:00:00Z', end_time: '2026-10-05T11:00:00Z' },
                { date: '2026-10-05', start_time: '2026-10-05T18:00:00Z', end_time: '2026-10-05T18:30:00Z' },
                { date: '2026-09-28', start_time: '2026-09-28T10:00:00Z', end_time: '2026-09-28T11:00:00Z' },
            ],
            { date: '2026-10-07' },
            TODAY
        )
        expect(summary.days.map((d) => d.minutes)).toEqual([90, 0, 0, 0, 0, 0, 0])
        expect(summary.totalMinutes).toBe(90)
    })

    it('counts consecutive trained weeks ending this week', () => {
        const finished = [
            { start_time: '2026-01-01T10:00:00Z', date: '2026-10-06' },
            { start_time: '2026-01-01T10:00:00Z', date: '2026-09-29' },
            { start_time: '2026-01-01T10:00:00Z', date: '2026-09-22' },
            { start_time: '2026-01-01T10:00:00Z', date: '2026-09-01' },
        ]
        expect(summarizeWeek(finished, null, TODAY).streakWeeks).toBe(3)
    })

    it('keeps the streak when this week has no workout yet', () => {
        const finished = [
            { start_time: '2026-01-01T10:00:00Z', date: '2026-09-29' },
            { start_time: '2026-01-01T10:00:00Z', date: '2026-09-22' },
        ]
        expect(summarizeWeek(finished, null, TODAY).streakWeeks).toBe(2)
    })

    it('has no streak after a missed week', () => {
        expect(
            summarizeWeek([{ start_time: '2026-01-01T10:00:00Z', date: '2026-09-22' }], null, TODAY).streakWeeks
        ).toBe(0)
    })
})

describe('workoutMinutes', () => {
    it('rounds the duration and is zero while running', () => {
        expect(workoutMinutes({ start_time: '2026-10-05T10:00:00Z', end_time: '2026-10-05T11:16:20Z' })).toBe(76)
        expect(workoutMinutes({ start_time: '2026-10-05T10:00:00Z' })).toBe(0)
    })
})
