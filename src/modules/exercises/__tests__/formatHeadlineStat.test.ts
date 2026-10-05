import { describe, expect, it } from 'vitest'
import { formatHeadlineStat } from '../ExerciseTypeMetadata'

describe('formatHeadlineStat', () => {
    it('gives each PrimaryMetric its unit', () => {
        expect(formatHeadlineStat('weight', 'weight', 116.666)).toBe('116.67 kg')
        expect(formatHeadlineStat('weight', 'weight', 120)).toBe('120 kg')
        expect(formatHeadlineStat('cardio', 'distance', 5200)).toBe('5.2km')
        expect(formatHeadlineStat('bodyweight_timer', 'duration', 1.5)).toBe('1:30')
    })
})
