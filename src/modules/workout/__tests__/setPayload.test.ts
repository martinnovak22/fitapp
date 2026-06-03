import { describe, expect, it } from 'vitest'
import type { ExerciseType } from '@/src/db/exercises'
import type { SubSet } from '@/src/db/workouts'
import { buildSetPayload, type SetFormValues } from '@/src/modules/workout/setPayload'

const emptyInputs: SetFormValues = {
    weight: '',
    reps: '',
    distance: '',
    durationMinutes: '',
    durationSeconds: '',
}

const build = (exerciseType: ExerciseType, inputValues: Partial<SetFormValues>, subSets: SubSet[] = []) =>
    buildSetPayload({ exerciseType, inputValues: { ...emptyInputs, ...inputValues }, subSets })

describe('buildSetPayload', () => {
    // Cases ported verbatim from scripts/test-build-set-payload.ts.
    describe('ported assertions', () => {
        it('builds a weight set with weight and reps', () => {
            const result = build('weight', { weight: '100', reps: '5' })

            expect(result.hasAnyData).toBe(true)
            expect(result.data.weight).toBe(100)
            expect(result.data.reps).toBe(5)
            expect(result.data.distance).toBeUndefined()
        })

        it('builds a cardio set with distance and combined duration', () => {
            const result = build('cardio', { distance: '1200', durationMinutes: '2', durationSeconds: '30' })

            expect(result.hasAnyData).toBe(true)
            expect(result.data.distance).toBe(1200)
            expect(result.data.duration).toBe(2.5)
        })

        it('reports no data and drops zero-only sub-sets', () => {
            const result = build('bodyweight', {}, [{ weight: 0, reps: 0 }])

            expect(result.hasAnyData).toBe(false)
            expect(result.data.sub_sets).toBeUndefined()
        })

        it('keeps only sub-sets with positive values and serializes them', () => {
            const result = build('weight', {}, [
                { weight: 80, reps: 8 },
                { weight: 0, reps: 0 },
            ])

            expect(result.hasAnyData).toBe(true)
            expect(result.hasSubSets).toBe(true)
            expect(result.data.sub_sets).toBe(JSON.stringify([{ weight: 80, reps: 8 }]))
        })
    })

    // Additional branches not exercised by the original script.
    describe('exercise-type field shaping', () => {
        it('cardio omits weight and reps entirely', () => {
            const result = build('cardio', { weight: '50', reps: '10', distance: '500' })

            expect(result.data.weight).toBeUndefined()
            expect(result.data.reps).toBeUndefined()
            expect(result.data.distance).toBe(500)
        })

        it('bodyweight keeps weight and reps but not distance', () => {
            const result = build('bodyweight', { weight: '20', reps: '12', distance: '99' })

            expect(result.data.weight).toBe(20)
            expect(result.data.reps).toBe(12)
            expect(result.data.distance).toBeUndefined()
        })

        it('bodyweight_timer keeps weight and duration but not reps or distance', () => {
            const result = build('bodyweight_timer', {
                weight: '15',
                reps: '8',
                distance: '99',
                durationMinutes: '1',
                durationSeconds: '0',
            })

            expect(result.data.weight).toBe(15)
            expect(result.data.reps).toBeUndefined()
            expect(result.data.distance).toBeUndefined()
            expect(result.data.duration).toBe(1)
        })

        it('weight set carries weight and reps but never duration', () => {
            const result = build('weight', { weight: '60', reps: '6', durationMinutes: '3' })

            expect(result.data.weight).toBe(60)
            expect(result.data.reps).toBe(6)
            expect(result.data.duration).toBeUndefined()
        })
    })

    describe('exercise-type normalization', () => {
        it('lowercases the incoming exercise type before branching', () => {
            const result = build('CARDIO' as ExerciseType, { distance: '300' })

            expect(result.data.weight).toBeUndefined()
            expect(result.data.distance).toBe(300)
        })
    })

    describe('duration parsing', () => {
        it('treats only seconds as a fractional-minute duration', () => {
            const result = build('cardio', { durationSeconds: '30' })

            expect(result.data.duration).toBe(0.5)
        })

        it('treats only minutes as a whole-minute duration', () => {
            const result = build('cardio', { durationMinutes: '3' })

            expect(result.data.duration).toBe(3)
        })

        it('leaves duration undefined when neither minutes nor seconds are given', () => {
            const result = build('cardio', { distance: '100' })

            expect(result.data.duration).toBeUndefined()
        })

        it('does not compute a duration for non-timed exercise types', () => {
            const result = build('weight', { durationMinutes: '5', durationSeconds: '30' })

            expect(result.data.duration).toBeUndefined()
        })
    })

    describe('number parsing', () => {
        it('parses comma decimals for weight and distance', () => {
            const weightResult = build('weight', { weight: '72,5', reps: '4' })
            expect(weightResult.data.weight).toBe(72.5)

            const cardioResult = build('cardio', { distance: '1,5' })
            expect(cardioResult.data.distance).toBe(1.5)
        })

        it('truncates reps to an integer', () => {
            const result = build('weight', { weight: '50', reps: '8.9' })

            expect(result.data.reps).toBe(8)
        })

        it('treats non-numeric input as undefined', () => {
            const result = build('weight', { weight: 'abc', reps: 'xyz' })

            expect(result.data.weight).toBeUndefined()
            expect(result.data.reps).toBeUndefined()
            expect(result.hasAnyData).toBe(false)
        })
    })

    describe('hasMainData / hasSubSets / hasAnyData', () => {
        it('ignores zero values when deciding main data', () => {
            const result = build('weight', { weight: '0', reps: '0' })

            expect(result.hasMainData).toBe(false)
            expect(result.hasSubSets).toBe(false)
            expect(result.hasAnyData).toBe(false)
        })

        it('flags main data from a single positive field', () => {
            const result = build('weight', { reps: '5' })

            expect(result.hasMainData).toBe(true)
            expect(result.hasAnyData).toBe(true)
        })

        it('flags any-data via sub-sets alone when main data is empty', () => {
            const result = build('weight', {}, [{ weight: 40 }])

            expect(result.hasMainData).toBe(false)
            expect(result.hasSubSets).toBe(true)
            expect(result.hasAnyData).toBe(true)
        })

        it('keeps a sub-set positive on reps alone', () => {
            const result = build('weight', {}, [{ reps: 12 }])

            expect(result.hasSubSets).toBe(true)
            expect(result.data.sub_sets).toBe(JSON.stringify([{ reps: 12 }]))
        })
    })
})
