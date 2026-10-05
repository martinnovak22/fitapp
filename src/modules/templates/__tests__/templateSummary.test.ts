import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import type { WorkoutTemplate } from '@/src/db/workoutTemplates'
import { templateSubtitle } from '../templateSummary'

// Echo the key (and count) so assertions read the mapping, not a translation.
const t = ((key: string, options?: { count?: number }) =>
    options?.count === undefined ? key : `${key}:${options.count}`) as unknown as TFunction

const template = { id: 1, name: 'Push' } as WorkoutTemplate

describe('templateSubtitle', () => {
    it('lists the Exercise count, then the muscle groups', () => {
        expect(templateSubtitle(t, { template, exerciseCount: 3, muscleGroups: ['chest', 'shoulders'] })).toBe(
            'exercisesCount:3 · muscle_chest, muscle_shoulders'
        )
    })

    it('leaves the groups out when there are none', () => {
        expect(templateSubtitle(t, { template, exerciseCount: 0, muscleGroups: [] })).toBe('exercisesCount:0')
    })
})
