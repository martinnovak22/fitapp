import { describe, expect, it } from 'vitest'
// biome-ignore lint/suspicious/noShadowRestrictedNames: domain model, not JS Set
import type { Set } from '@/src/db/workouts'
import { formatCompactSetLabel } from '../ExerciseTypeMetadata'

// Characterization tests: pin the exact label string each (exercise type,
// metric) combination produces today, before refactoring the function.
const set = (over: Partial<Set>): Set => ({ weight: 0, reps: 0, distance: 0, duration: 0, ...over }) as Set

describe('formatCompactSetLabel — weight', () => {
    it('renders weight×reps with compact weight and rounded reps', () => {
        expect(formatCompactSetLabel('weight', 'weight', set({ weight: 100, reps: 5 }))).toBe('100×5')
        expect(formatCompactSetLabel('weight', 'weight', set({ weight: 100.5, reps: 5.4 }))).toBe('100.5×5')
    })

    it('treats missing weight and reps as zero', () => {
        expect(formatCompactSetLabel('weight', 'weight', set({}))).toBe('0×0')
    })
})

describe('formatCompactSetLabel — bodyweight', () => {
    it('renders bare reps when there is no added/assisted weight', () => {
        expect(formatCompactSetLabel('bodyweight', 'reps', set({ reps: 10, weight: 0 }))).toBe('10')
    })

    it('appends signed weight when present', () => {
        expect(formatCompactSetLabel('bodyweight', 'reps', set({ reps: 10, weight: 10 }))).toBe('10 (+10)')
        expect(formatCompactSetLabel('bodyweight', 'reps', set({ reps: 10, weight: -20 }))).toBe('10 (-20)')
    })
})

describe('formatCompactSetLabel — bodyweight_timer', () => {
    it('renders the duration alone when there is no added weight', () => {
        expect(formatCompactSetLabel('bodyweight_timer', 'duration', set({ duration: 1.5, weight: 0 }))).toBe('1:30')
    })

    it('appends signed weight after the duration when present', () => {
        expect(formatCompactSetLabel('bodyweight_timer', 'duration', set({ duration: 1.5, weight: 10 }))).toBe(
            '1:30 (+10)'
        )
    })
})

describe('formatCompactSetLabel — cardio', () => {
    it('joins compact distance and duration with a middot', () => {
        expect(formatCompactSetLabel('cardio', 'distance', set({ distance: 5000, duration: 25.5 }))).toBe('5.0km·25:30')
        expect(formatCompactSetLabel('cardio', 'distance', set({ distance: 500, duration: 2 }))).toBe('500m·2:00')
    })
})
