import { describe, expect, it } from 'vitest'
import { computeMuscleBalance, muscleGroupsTrained } from '../muscleBalance'

describe('muscleGroupsTrained', () => {
    it('lists distinct groups in taxonomy order, from explicit keys and legacy text alike', () => {
        const sets = [{ primary_muscle: 'triceps' }, { muscle_group: 'hrudník' }, { muscle_group: 'chest' }, {}]
        expect(muscleGroupsTrained(sets)).toEqual(['chest', 'arms'])
    })
})

describe('computeMuscleBalance', () => {
    it('counts Sets per group, seeds untrained groups, and merges spellings of one group', () => {
        const exercises = [{ muscle_group: 'záda' }, { primary_muscle: 'quads' }, { muscle_group: 'chest' }]
        const sets = [
            { muscle_group: 'hrudnik' },
            { muscle_group: 'chest' },
            { primary_muscle: 'lats' },
            { muscle_group: 'gibberish' },
        ]

        expect(computeMuscleBalance(exercises, sets)).toEqual([
            { group: 'chest', count: 2 },
            { group: 'back', count: 1 },
            { group: null, count: 1 },
            { group: 'legs', count: 0 },
        ])
    })
})
