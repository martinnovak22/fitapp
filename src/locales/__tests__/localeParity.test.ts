import { describe, expect, it } from 'vitest'
import cs from '@/src/locales/cs.json'
import en from '@/src/locales/en.json'

// i18next appends CLDR plural categories as key suffixes, and languages have
// different category sets (en: one/other; cs: one/few/many/other). So a missing
// translation is a missing *base* key — compare keys with the plural suffix
// stripped rather than raw keys, otherwise every pluralized term looks divergent.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

const baseKeys = (dict: Record<string, unknown>): Set<string> =>
    new Set(Object.keys(dict).map((key) => key.replace(PLURAL_SUFFIX, '')))

describe('locale parity (en ⇄ cs)', () => {
    const enBase = baseKeys(en)
    const csBase = baseKeys(cs)

    it('cs defines every base key present in en', () => {
        const missingInCs = [...enBase].filter((key) => !csBase.has(key)).sort()
        expect(missingInCs).toEqual([])
    })

    it('en defines every base key present in cs', () => {
        const missingInEn = [...csBase].filter((key) => !enBase.has(key)).sort()
        expect(missingInEn).toEqual([])
    })
})
