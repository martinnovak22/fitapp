import { describe, expect, it } from 'vitest'
import { formatAxisDate, formatHourMinute } from '../dateTime'

describe('formatHourMinute', () => {
    const afternoon = new Date(2026, 9, 5, 15, 49)

    it("uses the app's language, not the device's", () => {
        expect(formatHourMinute(afternoon, 'cs')).toBe('15:49')
        expect(formatHourMinute(afternoon, 'en')).toMatch(/^0?3:49\sPM$/)
    })
})

describe('formatAxisDate', () => {
    it('drops the spaces Czech puts in a numeric date', () => {
        expect(formatAxisDate(new Date(2026, 7, 24), 'cs')).toBe('24.8.')
        expect(formatAxisDate(new Date(2026, 7, 24), 'en')).toBe('8/24')
    })
})
