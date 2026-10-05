import { describe, expect, it } from 'vitest'
import { installPluralRules, selectPlural } from '../pluralRules'

describe('selectPlural', () => {
    it('follows the Czech one / few / many / other rule', () => {
        expect([1, 2, 3, 4, 5, 0, 11, 22].map((n) => selectPlural('cs', n))).toEqual([
            'one',
            'few',
            'few',
            'few',
            'other',
            'other',
            'other',
            'other',
        ])
        expect(selectPlural('cs-CZ', 1.5)).toBe('many')
    })

    it('follows the English one / other rule', () => {
        expect([1, 0, 2, 1.5].map((n) => selectPlural('en', n))).toEqual(['one', 'other', 'other', 'other'])
    })

    it('matches the engine where Intl.PluralRules exists', () => {
        for (const locale of ['cs', 'en']) {
            const rules = new Intl.PluralRules(locale)
            for (const n of [0, 1, 2, 3, 4, 5, 12, 21, 1.5]) {
                expect(selectPlural(locale, n)).toBe(rules.select(n))
            }
        }
    })
})

type PluralRulesCtor = new (
    locale?: string | string[]
) => {
    select: (n: number) => string
    resolvedOptions: () => { locale: string; pluralCategories: string[] }
}

describe('installPluralRules', () => {
    it('adds PluralRules and keeps the non-enumerable rest of Intl', () => {
        const intl = {}
        Object.defineProperty(intl, 'NumberFormat', { value: Intl.NumberFormat, enumerable: false })
        const target = { Intl: intl }
        installPluralRules(target)
        const { PluralRules, NumberFormat } = target.Intl as { PluralRules: PluralRulesCtor; NumberFormat: unknown }
        expect(NumberFormat).toBe(Intl.NumberFormat)
        const rules = new PluralRules(['cs-CZ'])
        expect(rules.select(3)).toBe('few')
        expect(rules.resolvedOptions()).toEqual({ locale: 'cs', pluralCategories: ['one', 'few', 'many', 'other'] })
        expect(
            (PluralRules as unknown as { supportedLocalesOf: (l: string[]) => string[] }).supportedLocalesOf([
                'cs-CZ',
                'de',
            ])
        ).toEqual(['cs-CZ'])
    })

    it('creates Intl when the engine has none and leaves a native PluralRules alone', () => {
        const bare: { Intl?: object } = {}
        installPluralRules(bare)
        expect(typeof (bare.Intl as { PluralRules?: unknown }).PluralRules).toBe('function')

        const native = { Intl: { PluralRules: Intl.PluralRules } }
        installPluralRules(native)
        expect(native.Intl.PluralRules).toBe(Intl.PluralRules)
    })
})
