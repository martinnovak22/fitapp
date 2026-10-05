import { describe, expect, it } from 'vitest'
import { resolveSetColumns } from '../setColumns'

const keys = (type: Parameters<typeof resolveSetColumns>[0]) => resolveSetColumns(type).map((c) => c.key)

describe('resolveSetColumns', () => {
    it('records weight and reps for weight exercises', () => {
        expect(keys('weight')).toEqual(['weight', 'reps'])
        expect(resolveSetColumns('weight')[0].labelKey).toBe('colKg')
    })

    it('records added weight and reps for bodyweight reps', () => {
        expect(keys('bodyweight')).toEqual(['weight', 'reps'])
        expect(resolveSetColumns('bodyweight')[0].labelKey).toBe('colAddedKg')
    })

    it('records added weight and a duration for bodyweight timer', () => {
        expect(keys('bodyweight_timer')).toEqual(['weight', 'durationMinutes', 'durationSeconds'])
    })

    it('records distance and a duration for cardio', () => {
        expect(keys('cardio')).toEqual(['distance', 'durationMinutes', 'durationSeconds'])
    })

    it('uses a number pad for whole numbers and a decimal pad otherwise', () => {
        expect(resolveSetColumns('weight').map((c) => c.keyboard)).toEqual(['decimal-pad', 'number-pad'])
    })
})
