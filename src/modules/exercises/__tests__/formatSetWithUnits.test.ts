import { describe, expect, it } from 'vitest'
import type { Set as WorkoutSet } from '@/src/db/workouts'
import { formatSetWithUnits } from '../ExerciseTypeMetadata'

const set = (overrides: Partial<WorkoutSet>): WorkoutSet => ({
    id: 1,
    workout_id: 1,
    exercise_id: 1,
    position: 0,
    ...overrides,
})

describe('formatSetWithUnits', () => {
    it('spells a weight set out with kilograms', () => {
        expect(formatSetWithUnits('weight', set({ weight: 82.5, reps: 8 }))).toBe('82.5 kg × 8')
    })

    it("uses the caller's rep count and shows added load for bodyweight", () => {
        const reps = (n: number) => `${n} opakování`
        expect(formatSetWithUnits('bodyweight', set({ reps: 12, weight: 10 }), reps)).toBe('12 opakování (+10 kg)')
        expect(formatSetWithUnits('bodyweight', set({ reps: 12 }), reps)).toBe('12 opakování')
    })

    it('shows the hold time for timers and distance with time for cardio', () => {
        expect(formatSetWithUnits('bodyweight_timer', set({ duration: 1.5 }))).toBe('1:30')
        expect(formatSetWithUnits('cardio', set({ distance: 2400, duration: 12.5 }))).toBe('2.4km · 12:30')
    })
})
