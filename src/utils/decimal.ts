// The decimal separator numbers are shown with, following the app's language
// ("82,5" in Czech, "82.5" in English). i18n sets it whenever the language
// changes; every number input accepts both separators.

let separator = '.'

export const setDecimalSeparator = (language: string) => {
    separator = language.split(/[-_]/)[0] === 'cs' ? ',' : '.'
}

// Up to `maxFractionDigits` decimals, without trailing zeros: 82.5, 120, 1.25.
export const formatDecimal = (value: number, maxFractionDigits = 2): string => {
    const factor = 10 ** maxFractionDigits
    return String(Math.round(value * factor) / factor).replace('.', separator)
}

// Exactly `digits` decimals: 5.2 km, 1.50.
export const formatFixed = (value: number, digits: number): string => value.toFixed(digits).replace('.', separator)
