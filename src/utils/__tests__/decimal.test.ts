import { afterEach, describe, expect, it } from 'vitest'
import { formatDecimal, formatFixed, setDecimalSeparator } from '../decimal'

describe('decimal formatting', () => {
    afterEach(() => setDecimalSeparator('en'))

    it('uses a dot in English and drops trailing zeros', () => {
        expect(formatDecimal(82.5)).toBe('82.5')
        expect(formatDecimal(120)).toBe('120')
        expect(formatDecimal(1.256)).toBe('1.26')
        expect(formatFixed(5.2, 1)).toBe('5.2')
    })

    it('uses a comma in Czech', () => {
        setDecimalSeparator('cs-CZ')
        expect(formatDecimal(82.5)).toBe('82,5')
        expect(formatFixed(1.5, 2)).toBe('1,50')
    })
})
