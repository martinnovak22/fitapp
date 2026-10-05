// Month and weekday names for react-native-calendars in the app's language,
// taken from Intl so they match the dates shown elsewhere. The library wants
// weekdays Sunday first and names its "today" label separately.

const capitalizeFirst = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

const localeFor = (language: string) => (language === 'cs' ? 'cs-CZ' : 'en-US')

export type CalendarLocale = {
    monthNames: string[]
    monthNamesShort: string[]
    dayNames: string[]
    dayNamesShort: string[]
    today: string
}

export const buildCalendarLocale = (language: string, today: string): CalendarLocale => {
    const locale = localeFor(language)
    const months = Array.from({ length: 12 }, (_, month) => new Date(2026, month, 1))
    // 4 January 2026 is a Sunday.
    const weekdays = Array.from({ length: 7 }, (_, day) => new Date(2026, 0, 4 + day))
    const format = (options: Intl.DateTimeFormatOptions) => (date: Date) =>
        capitalizeFirst(new Intl.DateTimeFormat(locale, options).format(date).replace(/\.$/, ''))
    return {
        monthNames: months.map(format({ month: 'long' })),
        monthNamesShort: months.map(format({ month: 'short' })),
        dayNames: weekdays.map(format({ weekday: 'long' })),
        dayNamesShort: weekdays.map(format({ weekday: 'short' })),
        today,
    }
}
