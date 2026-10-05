// Folds text for matching, never for display: diacritics stripped, lowercase,
// whitespace collapsed and trimmed, so "  Široký Sval" matches "siroky sval".
// The one rule behind search, Exercise de-duplication and legacy muscle
// mapping.
export const foldText = (value: string): string =>
    value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
