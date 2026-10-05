const getLocaleFromLanguage = (language: string): string => {
    return language === 'cs' ? 'cs-CZ' : 'en-US'
}

const capitalizeFirst = (value: string): string => {
    if (!value) return value
    return value.charAt(0).toUpperCase() + value.slice(1)
}

export const formatLocalizedDate = (
    value: string | Date,
    language: string,
    options: Intl.DateTimeFormatOptions,
    capitalize = false
): string => {
    const dateValue = value instanceof Date ? value : new Date(value)
    const formatted = dateValue.toLocaleDateString(getLocaleFromLanguage(language), options)
    return capitalize ? capitalizeFirst(formatted) : formatted
}

// The time in the app's language ("15:49" in Czech, "3:49 PM" in English),
// not the device's.
export const formatHourMinute = (value: string | Date, language?: string): string => {
    const dateValue = value instanceof Date ? value : new Date(value)
    return dateValue.toLocaleTimeString(language ? getLocaleFromLanguage(language) : [], {
        hour: '2-digit',
        minute: '2-digit',
    })
}

export const formatLocalDateYYYYMMDD = (value: Date = new Date()): string => {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/** Parse a YYYY-MM-DD string as a local-time date (new Date(str) would parse it as UTC). */
export const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
}
