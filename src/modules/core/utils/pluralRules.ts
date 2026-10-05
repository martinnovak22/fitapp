// CLDR cardinal plural rules for the app's two languages. Hermes on Android
// ships without Intl.PluralRules, so i18next fell back to the "other" form
// everywhere ("2 sérií" instead of "2 série"). installPluralRules fills the
// gap when the engine lacks it; the rules themselves are plain functions.

type PluralCategory = 'one' | 'few' | 'many' | 'other'

const CATEGORIES: Record<string, PluralCategory[]> = {
    en: ['one', 'other'],
    cs: ['one', 'few', 'many', 'other'],
}

const baseLanguage = (locale: string | undefined): string => (locale ?? 'en').split(/[-_]/)[0].toLowerCase()

export const selectPlural = (locale: string | undefined, value: number): PluralCategory => {
    const n = Math.abs(value)
    const isInteger = Number.isInteger(n)
    switch (baseLanguage(locale)) {
        case 'cs':
            if (!isInteger) return 'many'
            if (n === 1) return 'one'
            if (n >= 2 && n <= 4) return 'few'
            return 'other'
        default:
            return isInteger && n === 1 ? 'one' : 'other'
    }
}

class PluralRulesPolyfill {
    private readonly locale: string

    constructor(locales?: string | string[]) {
        this.locale = baseLanguage(Array.isArray(locales) ? locales[0] : locales)
    }

    select(value: number): PluralCategory {
        return selectPlural(this.locale, value)
    }

    resolvedOptions() {
        return { locale: this.locale, pluralCategories: CATEGORIES[this.locale] ?? CATEGORIES.en }
    }

    static supportedLocalesOf(locales: string | string[]): string[] {
        return (Array.isArray(locales) ? locales : [locales]).filter((locale) => baseLanguage(locale) in CATEGORIES)
    }
}

// Adds only PluralRules to the engine's Intl, leaving NumberFormat,
// DateTimeFormat and the rest untouched (they are non-enumerable, so a spread
// copy would drop them).
export const installPluralRules = (target: { Intl?: object } = globalThis) => {
    const intl = target.Intl as { PluralRules?: unknown } | undefined
    if (intl && typeof intl.PluralRules === 'function') return
    if (!intl) {
        Object.defineProperty(target, 'Intl', { value: {}, configurable: true, writable: true })
    }
    Object.defineProperty(target.Intl, 'PluralRules', {
        value: PluralRulesPolyfill,
        configurable: true,
        writable: true,
    })
}
