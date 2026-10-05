import { describe, expect, it } from 'vitest'
import { formatHourMinute } from '../dateTime'

describe('formatHourMinute', () => {
    const afternoon = new Date(2026, 9, 5, 15, 49)

    it("uses the app's language, not the device's", () => {
        expect(formatHourMinute(afternoon, 'cs')).toBe('15:49')
        expect(formatHourMinute(afternoon, 'en')).toMatch(/^0?3:49\sPM$/)
    })
})
