import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import { exerciseMuscleLabels } from '../taxonomyLabels'

// Echo the key so assertions read the mapping, not a translation.
const t = ((key: string) => key) as unknown as TFunction

describe('exerciseMuscleLabels', () => {
    it('labels the primary Muscle first, then the secondary ones', () => {
        expect(
            exerciseMuscleLabels(t, {
                primary_muscle: 'lats',
                secondary_muscles: '["biceps","rear_delts"]',
                muscle_group: 'back',
            })
        ).toEqual(['muscle_lats', 'muscle_biceps', 'muscle_rear_delts'])
    })

    it('is empty when nothing maps to a Muscle', () => {
        expect(exerciseMuscleLabels(t, { primary_muscle: null, muscle_group: 'nonsense' })).toEqual([])
    })
})
