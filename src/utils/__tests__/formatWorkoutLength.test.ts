import { describe, expect, it } from 'vitest'
import { formatWorkoutLength } from '../formatters'

describe('formatWorkoutLength', () => {
    it('shows minutes under an hour and hours with minutes above', () => {
        expect(formatWorkoutLength(45, 'min')).toBe('45 min')
        expect(formatWorkoutLength(76, 'min')).toBe('1 h 16 min')
        expect(formatWorkoutLength(0, 'min')).toBe('0 min')
    })
})
