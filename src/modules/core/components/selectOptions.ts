// Pure option logic behind SelectSheet: search folding, section grouping and
// multi-select toggling. Kept free of React Native so it stays unit-testable.

export type SelectOption<V extends string = string> = {
    value: V
    label: string
    // Section title the option is listed under (e.g. its Muscle Group).
    section?: string
    // Secondary line under the label; also matched by search.
    description?: string
}

export type SelectSection<V extends string = string> = {
    // null for options without a section; rendered without a header.
    title: string | null
    options: SelectOption<V>[]
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
export const filterOptions = <V extends string>(
    options: readonly SelectOption<V>[],
    query: string
): SelectOption<V>[] => {
    const tokens = foldText(query).split(' ').filter(Boolean)
    if (tokens.length === 0) return [...options]
    return options.filter((option) => {
        const haystack = foldText([option.label, option.description, option.section].filter(Boolean).join(' '))
        return tokens.every((token) => haystack.includes(token))
    })
}

// Groups options by section in first-seen order; option order within a section
// is preserved.
export const groupOptions = <V extends string>(options: readonly SelectOption<V>[]): SelectSection<V>[] => {
    const sections: SelectSection<V>[] = []
    const byTitle = new Map<string | null, SelectSection<V>>()
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

// The value a ListRow shows for a multi selection: the first labels, then a
// count of the rest ("Triceps, Front delts +2"). Empty when nothing is picked.
export const summarizeSelection = (labels: readonly string[], maxShown = 2): string => {
    const shown = labels.slice(0, maxShown).join(', ')
    const hidden = labels.length - maxShown
    return hidden > 0 ? `${shown} +${hidden}` : shown
}

export const toggleValue = <V extends string>(values: readonly V[], value: V): V[] =>
    values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
