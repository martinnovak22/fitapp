import { describe, expect, it } from 'vitest'
import { initialsOf } from '../initials'

describe('initialsOf', () => {
    it('takes the first letter of up to two words', () => {
        expect(initialsOf('Push A')).toBe('PA')
        expect(initialsOf('  monday ')).toBe('M')
        expect(initialsOf('Full body day three')).toBe('FB')
        expect(initialsOf('Šlapky')).toBe('Š')
    })
})
