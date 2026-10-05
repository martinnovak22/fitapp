import { describe, expect, it } from 'vitest'
import type { SetSummaryRow } from '@/src/db/workouts'
import { groupByMonth, setsSince, summarizeWorkoutSets, weeklyTotals } from '../historySummary'

const row = (overrides: Partial<SetSummaryRow>): SetSummaryRow => ({
    workout_id: 1,
    exercise_id: 1,
    weight: 0,
    reps: 0,
    position: 0,
    exercise_name: 'Bench',
    exercise_type: 'weight',
    muscle_group: null,
    primary_muscle: 'chest',
    ...overrides,
})

describe('summarizeWorkoutSets', () => {
    it('counts sets, sums weight volume with drops and ranks the top three exercises', () => {
        const summaries = summarizeWorkoutSets([
            row({ exercise_name: 'Squat', weight: 100, reps: 5 }),
            row({ exercise_name: 'Bench', weight: 60, reps: 8 }),
            row({ exercise_name: 'Bench', weight: 60, reps: 8, sub_sets: JSON.stringify([{ weight: 40, reps: 6 }]) }),
            row({ exercise_name: 'Pull up', exercise_type: 'bodyweight', reps: 10 }),
            row({ exercise_name: 'Curl', weight: 10, reps: 10 }),
            row({ workout_id: 2, exercise_name: 'Row', weight: 50, reps: 10 }),
        ])
        expect(summaries.get(1)).toEqual({
            setCount: 5,
            volumeKg: 500 + 480 + 480 + 240 + 100,
            topExercises: ['Bench', 'Squat', 'Pull up'],
        })
        expect(summaries.get(2)?.volumeKg).toBe(500)
    })
})

describe('groupByMonth', () => {
    it('groups consecutive workouts by month, newest first as given', () => {
        const sections = groupByMonth([{ date: '2026-10-05' }, { date: '2026-10-01' }, { date: '2026-09-28' }])
        expect(sections.map((s) => [s.key, s.data.length])).toEqual([
            ['2026-10', 2],
            ['2026-09', 1],
        ])
        expect(sections[0].month.getMonth()).toBe(9)
    })
})

describe('weeklyTotals', () => {
    it('totals workouts and volume per week for the last weeks, oldest first', () => {
        const summaries = new Map([
            [1, { setCount: 3, volumeKg: 1000, topExercises: [] }],
            [2, { setCount: 3, volumeKg: 500, topExercises: [] }],
            [3, { setCount: 3, volumeKg: 900, topExercises: [] }],
        ])
        const totals = weeklyTotals(
            [
                { id: 1, date: '2026-10-05' },
                { id: 2, date: '2026-09-28' },
                { id: 3, date: '2026-07-01' },
            ],
            summaries,
            new Date(2026, 9, 7),
            4
        )
        expect(totals.map((t) => [t.weekStart.getDate(), t.workouts, t.volumeKg])).toEqual([
            [14, 0, 0],
            [21, 0, 0],
            [28, 1, 500],
            [5, 1, 1000],
        ])
    })
})

describe('setsSince', () => {
    it('keeps sets of workouts on or after the date', () => {
        const rows = [row({ workout_id: 1 }), row({ workout_id: 2 })]
        const workouts = [
            { id: 1, date: '2026-09-01' },
            { id: 2, date: '2026-10-01' },
        ]
        expect(setsSince(rows, workouts, '2026-09-15').map((r) => r.workout_id)).toEqual([2])
    })
})
