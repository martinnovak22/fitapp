// Pure option logic behind SelectSheet: search folding, section grouping and
// multi-select toggling. Kept free of React Native so it stays unit-testable.

export type SelectOption = {
    value: string
    label: string
    // Section title the option is listed under (e.g. its Muscle Group).
    section?: string
    // Secondary line under the label; also matched by search.
    description?: string
}

export type SelectSection = {
    // null for options without a section; rendered without a header.
    title: string | null
    options: SelectOption[]
}

// Lists longer than this get a search field. Short lists read faster without one.
export const SEARCH_THRESHOLD = 8

export const shouldShowSearch = (optionCount: number): boolean => optionCount > SEARCH_THRESHOLD

// Case-, whitespace- and diacritic-insensitive, so "biceps" finds "Biceps" and
// "zada" finds "Záda".
export const foldText = (value: string): string =>
    value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()

// Every whitespace-separated query token must appear in the label, description
// or section, so "front delt" matches "Front delts" under "Shoulders".
export const filterOptions = (options: readonly SelectOption[], query: string): SelectOption[] => {
    const tokens = foldText(query).split(' ').filter(Boolean)
    if (tokens.length === 0) return [...options]
    return options.filter((option) => {
        const haystack = foldText([option.label, option.description, option.section].filter(Boolean).join(' '))
        return tokens.every((token) => haystack.includes(token))
    })
}

// Groups options by section in first-seen order; option order within a section
// is preserved.
export const groupOptions = (options: readonly SelectOption[]): SelectSection[] => {
    const sections: SelectSection[] = []
    const byTitle = new Map<string | null, SelectSection>()
    for (const option of options) {
        const title = option.section ?? null
        let section = byTitle.get(title)
        if (!section) {
            section = { title, options: [] }
            byTitle.set(title, section)
            sections.push(section)
        }
        section.options.push(option)
    }
    return sections
}

export const toggleValue = (values: readonly string[], value: string): string[] =>
    values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
