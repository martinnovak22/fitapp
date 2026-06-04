import { describe, expect, it } from 'vitest'
import { parseSetInputNumber, reconcileSubSetKeys } from '../dropSet'

describe('reconcileSubSetKeys', () => {
    const counter = () => {
        let n = 0
        return () => {
            n += 1
            return `k${n}`
        }
    }

    it('returns the same array reference when the length already matches', () => {
        const prev = ['a', 'b']
        expect(reconcileSubSetKeys(prev, 2, counter())).toBe(prev)
    })

    it('appends fresh keys when the list grew, keeping existing keys in place', () => {
        expect(reconcileSubSetKeys(['a', 'b'], 4, counter())).toEqual(['a', 'b', 'k1', 'k2'])
    })

    it('truncates from the end when the list shrank', () => {
        expect(reconcileSubSetKeys(['a', 'b', 'c'], 1, counter())).toEqual(['a'])
    })

    it('produces keys from scratch when growing from empty', () => {
        expect(reconcileSubSetKeys([], 2, counter())).toEqual(['k1', 'k2'])
    })
})

describe('parseSetInputNumber', () => {
    it('parses a plain decimal', () => {
        expect(parseSetInputNumber('12.5')).toBe(12.5)
    })

    it('accepts a comma as the decimal separator', () => {
        expect(parseSetInputNumber('12,5')).toBe(12.5)
    })

    it('falls back to 0 for empty or non-numeric input', () => {
        expect(parseSetInputNumber('')).toBe(0)
        expect(parseSetInputNumber('abc')).toBe(0)
    })
})
