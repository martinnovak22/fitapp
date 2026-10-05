import { describe, expect, it } from 'vitest'
import { buildCalendarLocale } from '../calendarLocale'

describe('buildCalendarLocale', () => {
    it('names Czech months in the nominative and weekdays Sunday first', () => {
        const cs = buildCalendarLocale('cs', 'Dnes')
        expect(cs.monthNames[9]).toBe('Říjen')
        expect(cs.dayNamesShort[0]).toBe('Ne')
        expect(cs.dayNamesShort[1]).toBe('Po')
        expect(cs.today).toBe('Dnes')
    })

    it('names English months and weekdays', () => {
        const en = buildCalendarLocale('en', 'Today')
        expect(en.monthNames[0]).toBe('January')
        expect(en.dayNamesShort.slice(0, 2)).toEqual(['Sun', 'Mon'])
    })
})
