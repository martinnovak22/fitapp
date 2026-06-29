import { describe, expect, it } from 'vitest'
import cs from '@/src/locales/cs.json'
import en from '@/src/locales/en.json'

// The locale dictionaries are flat string maps. These tests guard the three
// ways en and cs can silently drift apart at runtime:
//   1. a base key missing from one language,
//   2. a pluralized key missing one of its language's CLDR categories,
//   3. an interpolation placeholder ({{var}}) present in one but not the other.
// i18next resolves all three at call time, so drift never fails a build — only
// these assertions do.

// i18next appends CLDR plural categories as key suffixes, and languages have
// different category sets (en: one/other; cs: one/few/many/other). So a missing
// translation is a missing *base* key — compare keys with the plural suffix
// stripped rather than raw keys, otherwise every pluralized term looks divergent.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

const LOCALES = { en, cs } as const
type Lang = keyof typeof LOCALES

const baseKey = (key: string): string => key.replace(PLURAL_SUFFIX, '')

const baseKeys = (dict: Record<string, unknown>): Set<string> => new Set(Object.keys(dict).map(baseKey))

// {{count}}, {{name}}, {{ value }} — the variables i18next interpolates. Order
// doesn't matter, so compare as a sorted set.
const placeholders = (value: string): string[] => [...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort()

// Stems that carry a plural suffix in this dictionary, mapped to the categories
// they actually define.
const pluralCategoriesByStem = (dict: Record<string, unknown>): Map<string, Set<string>> => {
    const stems = new Map<string, Set<string>>()
    for (const key of Object.keys(dict)) {
        const match = key.match(PLURAL_SUFFIX)
        if (!match) continue
        const stem = key.slice(0, match.index)
        const category = match[1]
        const set = stems.get(stem) ?? new Set<string>()
        set.add(category)
        stems.set(stem, set)
    }
    return stems
}

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

    // A pluralized stem must define every CLDR cardinal category its language
    // uses, or i18next falls back (often to `other`) and renders grammatically
    // wrong text — e.g. Czech "2 sety" needs `few`, distinct from `other` (5+).
    it.each(
        Object.keys(LOCALES) as Lang[]
    )('%s defines all CLDR plural categories for each pluralized stem', (lang) => {
        const required = new Intl.PluralRules(lang).resolvedOptions().pluralCategories
        const incomplete = [...pluralCategoriesByStem(LOCALES[lang])]
            .map(([stem, present]) => ({
                stem,
                missing: required.filter((category) => !present.has(category)),
            }))
            .filter((entry) => entry.missing.length > 0)
        expect(incomplete).toEqual([])
    })

    // A placeholder present in one language but not the other means a value
    // silently goes uninterpolated (or an unexpected token renders literally).
    it('interpolation placeholders match for every shared key', () => {
        const mismatched = Object.keys(en)
            .filter((key) => key in cs)
            .map((key) => ({
                key,
                en: placeholders(en[key as keyof typeof en]),
                cs: placeholders(cs[key as keyof typeof cs]),
            }))
            .filter(({ en: e, cs: c }) => JSON.stringify(e) !== JSON.stringify(c))
        expect(mismatched).toEqual([])
    })
})
