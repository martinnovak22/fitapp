import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { formatLocalizedDate } from '@/src/utils/dateTime'
import type { WeekDay } from '../weekSummary'

const CHART_HEIGHT = 56
const MIN_BAR = 12

// This week as seven bars, Monday first: bar length is minutes trained, so
// the shape of the week reads at a glance. A day with a Workout still
// running shows an outlined bar; untrained days a short neutral stub.
export function WeekChart({ days }: { days: readonly WeekDay[] }) {
    const { i18n } = useTranslation()
    const { theme } = useTheme()
    const maxMinutes = Math.max(...days.map((day) => day.minutes), 1)

    return (
        <View style={styles.row}>
            {days.map((day) => {
                const running = day.workedOut && day.minutes === 0
                const height =
                    day.minutes > 0 ? Math.max(MIN_BAR, (day.minutes / maxMinutes) * CHART_HEIGHT) : MIN_BAR / 2
                return (
                    <View key={day.date} style={styles.column}>
                        <View style={styles.track}>
                            <View
                                style={[
                                    styles.bar,
                                    { height: running ? MIN_BAR : height },
                                    day.minutes > 0
                                        ? { backgroundColor: theme.primary }
                                        : running
                                          ? { borderWidth: 1.5, borderColor: theme.primary }
                                          : { backgroundColor: theme.inputBackgroundActive },
                                ]}
                            />
                        </View>
                        <Typography.Meta
                            color={day.isToday ? 'text' : 'textSecondary'}
                            weight={day.isToday ? 'bold' : 'regular'}
                        >
                            {formatLocalizedDate(day.day, i18n.language, { weekday: 'narrow' })}
                        </Typography.Meta>
                        <View style={[styles.todayMark, day.isToday && { backgroundColor: theme.text }]} />
                    </View>
                )
            })}
        </View>
    )
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
    },
    column: {
        flex: 1,
        alignItems: 'center',
        gap: Spacing.xs,
    },
    track: {
        height: CHART_HEIGHT,
        justifyContent: 'flex-end',
    },
    bar: {
        width: 16,
        borderRadius: Radius.xs + 2,
    },
    todayMark: {
        width: 4,
        height: 4,
        borderRadius: Radius.pill,
    },
})
