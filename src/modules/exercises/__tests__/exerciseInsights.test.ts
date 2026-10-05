import { describe, expect, it } from 'vitest'
import type { Set as WorkoutSet } from '@/src/db/workouts'
import { chartPoints, estimateOneRepMax, filterByRange, fitAxis, personalRecord } from '../exerciseInsights'

const set = (overrides: Partial<WorkoutSet>): WorkoutSet => ({
    id: 1,
    workout_id: 1,
    exercise_id: 1,
    position: 0,
    ...overrides,
})

describe('estimateOneRepMax', () => {
    it('uses Epley for 2–12 reps and the weight itself for a single', () => {
        expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 1)
        expect(estimateOneRepMax(140, 1)).toBe(140)
    })

    it('gives no estimate above 12 reps or without weight and reps', () => {
        expect(estimateOneRepMax(60, 13)).toBeNull()
        expect(estimateOneRepMax(0, 5)).toBeNull()
        expect(estimateOneRepMax(60, undefined)).toBeNull()
    })
})

describe('filterByRange', () => {
    const today = new Date(2026, 9, 5)
    const entries = [{ date: '2025-09-01' }, { date: '2026-07-20' }, { date: '2026-09-20' }, { date: '2026-10-05' }]

    it('keeps the last month, three months or year', () => {
        expect(filterByRange(entries, '1m', today).map((e) => e.date)).toEqual(['2026-09-20', '2026-10-05'])
        expect(filterByRange(entries, '3m', today).map((e) => e.date)).toEqual([
            '2026-07-20',
            '2026-09-20',
            '2026-10-05',
        ])
        expect(filterByRange(entries, '1y', today)).toHaveLength(3)
        expect(filterByRange(entries, 'all', today)).toHaveLength(4)
    })
})

describe('personalRecord', () => {
    it('picks the heaviest session for weight, with its estimated max', () => {
        const record = personalRecord('weight', [
            { date: '2026-09-01', set: set({ weight: 100, reps: 5 }) },
            { date: '2026-09-08', set: set({ weight: 105, reps: 3 }) },
            { date: '2026-09-15', set: set({ weight: 100, reps: 8 }) },
        ])
        expect(record?.entry.date).toBe('2026-09-08')
        expect(record?.estimatedOneRepMax).toBeCloseTo(115.5, 1)
    })

    it('picks the most reps for bodyweight and gives no estimate', () => {
        const record = personalRecord('bodyweight', [
            { date: '2026-09-01', set: set({ reps: 12 }) },
            { date: '2026-09-08', set: set({ reps: 15 }) },
        ])
        expect(record?.entry.date).toBe('2026-09-08')
        expect(record?.estimatedOneRepMax).toBeNull()
    })

    it('is null without history', () => {
        expect(personalRecord('weight', [])).toBeNull()
    })
})

describe('chartPoints', () => {
    const entries = [
        { date: '2026-09-01', set: set({ weight: 100, reps: 5 }) },
        { date: '2026-09-08', set: set({ weight: 60, reps: 20 }) },
    ]

    it('plots the best value, or the estimated max where there is one', () => {
        expect(chartPoints(entries, 'best', 'weight').map((p) => p.value)).toEqual([100, 60])
        expect(chartPoints(entries, 'oneRepMax', 'weight').map((p) => p.date)).toEqual(['2026-09-01'])
    })
})

describe('fitAxis', () => {
    it('starts just below the lowest value on a round step and covers the highest', () => {
        const axis = fitAxis([70, 72.5, 75, 77.5, 80, 82.5])
        expect(axis.stepValue).toBe(5)
        expect(axis.offset).toBe(65)
        expect(axis.offset + axis.maxValue).toBeGreaterThanOrEqual(82.5)
    })

    it('keeps a single value inside the axis and never starts below zero', () => {
        const single = fitAxis([3])
        expect(single.offset).toBeLessThanOrEqual(3)
        expect(single.offset + single.maxValue).toBeGreaterThanOrEqual(3)
        expect(fitAxis([0, 1]).offset).toBe(0)
        expect(fitAxis([]).maxValue).toBe(4)
        expect(fitAxis([10, Number.NaN]).maxValue).toBe(4)
    })

    it('never tops out below the highest value', () => {
        for (const values of [
            [105, 135],
            [99, 131],
            [1, 9.5],
            [47.5, 102.5],
        ]) {
            const axis = fitAxis(values)
            expect(axis.offset).toBeLessThanOrEqual(Math.min(...values))
            expect(axis.offset + axis.maxValue).toBeGreaterThanOrEqual(Math.max(...values))
        }
    })
})
