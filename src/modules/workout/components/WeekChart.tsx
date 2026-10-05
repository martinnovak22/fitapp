import { useTranslation } from 'react-i18next'
import { MiniBarChart } from '@/src/modules/core/components/MiniBarChart'
import { formatLocalizedDate } from '@/src/utils/dateTime'
import type { WeekDay } from '../weekSummary'

// This week as seven bars, Monday first: bar length is minutes trained. A day
// with a Workout still running shows an outlined bar.
export function WeekChart({ days }: { days: readonly WeekDay[] }) {
    const { i18n } = useTranslation()
    return (
        <MiniBarChart
            bars={days.map((day) => ({
                key: day.date,
                label: formatLocalizedDate(day.day, i18n.language, { weekday: 'narrow' }),
                value: day.minutes,
                current: day.isToday,
                pending: day.workedOut && day.minutes === 0,
            }))}
        />
    )
}
