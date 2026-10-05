import { describe, expect, it } from 'vitest'
import {
    filterOptions,
    foldText,
    groupOptions,
    type SelectOption,
    shouldShowSearch,
    summarizeSelection,
    toggleValue,
} from '../selectOptions'

const options: SelectOption[] = [
    { value: 'biceps', label: 'Biceps', section: 'Paže' },
    { value: 'triceps', label: 'Triceps', section: 'Paže' },
    { value: 'lats', label: 'Široký sval zádový', section: 'Záda' },
    { value: 'front_delts', label: 'Front delts', section: 'Shoulders', description: 'Anterior' },
    { value: 'none', label: 'None' },
]

describe('foldText', () => {
    it('folds case, diacritics and whitespace', () => {
        expect(foldText('  Široký   Sval ')).toBe('siroky sval')
    })
})

describe('filterOptions', () => {
    it('returns every option for a blank query', () => {
        expect(filterOptions(options, '   ')).toEqual(options)
    })

    it('matches without diacritics', () => {
        expect(filterOptions(options, 'siroky').map((o) => o.value)).toEqual(['lats'])
    })

    it('matches the section title', () => {
        expect(filterOptions(options, 'zada').map((o) => o.value)).toEqual(['lats'])
    })

    it('requires every token, across label and description', () => {
        expect(filterOptions(options, 'delts anterior').map((o) => o.value)).toEqual(['front_delts'])
        expect(filterOptions(options, 'delts biceps')).toEqual([])
    })
})

describe('groupOptions', () => {
    it('groups by section in first-seen order and keeps option order', () => {
        const sections = groupOptions(options)
        expect(sections.map((s) => s.title)).toEqual(['Paže', 'Záda', 'Shoulders', null])
        expect(sections[0].options.map((o) => o.value)).toEqual(['biceps', 'triceps'])
    })

    it('regroups a non-contiguous section into one', () => {
        const sections = groupOptions([
            { value: 'a', label: 'A', section: 'X' },
            { value: 'b', label: 'B', section: 'Y' },
            { value: 'c', label: 'C', section: 'X' },
        ])
        expect(sections.map((s) => [s.title, s.options.map((o) => o.value)])).toEqual([
            ['X', ['a', 'c']],
            ['Y', ['b']],
        ])
    })
})

describe('toggleValue', () => {
    it('adds a missing value at the end and removes a present one', () => {
        expect(toggleValue(['a'], 'b')).toEqual(['a', 'b'])
        expect(toggleValue(['a', 'b'], 'a')).toEqual(['b'])
    })
})

describe('summarizeSelection', () => {
    it('lists up to two labels and counts the rest', () => {
        expect(summarizeSelection([])).toBe('')
        expect(summarizeSelection(['Triceps'])).toBe('Triceps')
        expect(summarizeSelection(['Triceps', 'Front delts'])).toBe('Triceps, Front delts')
        expect(summarizeSelection(['Triceps', 'Front delts', 'Abs', 'Calves'])).toBe('Triceps, Front delts +2')
    })
})

describe('shouldShowSearch', () => {
    it('shows search only for lists longer than the threshold', () => {
        expect(shouldShowSearch(8)).toBe(false)
        expect(shouldShowSearch(9)).toBe(true)
    })
})
