import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { Motion } from '@/src/constants/Motion'
import { Spacing } from '@/src/constants/Spacing'
import { GlobalStyles } from '@/src/constants/Styles'
import { FontSize, FontWeight } from '@/src/constants/Typography'
import type { Workout } from '@/src/db/workouts'
import { Card } from '@/src/modules/core/components/Card'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { formatHourMinute, formatLocalizedDate } from '@/src/utils/dateTime'

// Hoisted builders. The populated list and the empty state share one entrance,
// so selecting any day animates the same way instead of the empty state
// jumping in.
const DAY_DETAIL_ENTER = Motion.screenEnter().delay(140)
const DAY_DETAIL_EXIT = Motion.fadeOutDown()

interface CalendarDayDetailProps {
    selectedDate: string
    dayWorkouts: Workout[]
    onOpenSummary: (workout: Workout) => void
}

// The detail panel under the calendar for the selected day: either the day's
// workout cards or an empty state, sharing one header and entrance.
export function CalendarDayDetail({ selectedDate, dayWorkouts, onOpenSummary }: CalendarDayDetailProps) {
    const { t, i18n } = useTranslation()
    const { theme } = useTheme()

    const header = (
        <Typography.Subtitle style={[styles.dayHeader, { color: theme.text }]}>
            {formatLocalizedDate(
                selectedDate,
                i18n.language,
                { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
                true
            )}
        </Typography.Subtitle>
    )

    if (dayWorkouts.length === 0) {
        return (
            <Animated.View key={`${selectedDate}-empty`} entering={DAY_DETAIL_ENTER} exiting={DAY_DETAIL_EXIT}>
                {header}
                <EmptyState message={t('noWorkoutsRecorded')} icon={'calendar-o'} />
            </Animated.View>
        )
    }

    return (
        <Animated.View key={`${selectedDate}-list`} entering={DAY_DETAIL_ENTER} exiting={DAY_DETAIL_EXIT}>
            {header}
            {dayWorkouts.map((w, index) => (
                <Animated.View key={w.id} entering={Motion.listItem(index)}>
                    <Card
                        style={styles.workoutCard}
                        onPress={() => onOpenSummary(w)}
                        accessibilityLabel={`${formatHourMinute(w.start_time)} ${w.end_time ? `- ${formatHourMinute(w.end_time)}` : t('inProgress')}`}
                        accessibilityHint={t('viewSummary')}
                    >
                        <View style={styles.workoutCardRow}>
                            <View>
                                <Typography.Body style={[styles.workoutTime, { color: theme.text }]}>
                                    {formatHourMinute(w.start_time)}{' '}
                                    {w.end_time ? `- ${formatHourMinute(w.end_time)}` : `(${t('inProgress')})`}
                                </Typography.Body>
                                <Typography.Meta style={[styles.workoutStatus, { color: theme.textSecondary }]}>
                                    {w.status === 'finished' ? t('completed') : t('activeSession')}
                                </Typography.Meta>
                            </View>
                            <View style={styles.workoutAction}>
                                <Typography.Meta style={[styles.viewSummaryText, { color: theme.primary }]}>
                                    {t('viewSummary')}
                                </Typography.Meta>
                                <FontAwesome name="chevron-right" size={12} color={theme.primary} />
                            </View>
                        </View>
                    </Card>
                </Animated.View>
            ))}
        </Animated.View>
    )
}

const styles = StyleSheet.create({
    dayHeader: {
        ...GlobalStyles.subtitle,
        marginBottom: Spacing.md,
        marginTop: Spacing.md,
    },
    workoutCard: {
        marginBottom: Spacing.md,
        padding: Spacing.md,
    },
    workoutCardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    workoutTime: {
        ...GlobalStyles.text,
        fontWeight: FontWeight.bold,
        fontSize: FontSize.sm,
    },
    workoutStatus: {
        ...GlobalStyles.text,
        fontSize: FontSize.xs,
        marginTop: 2,
    },
    workoutAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    viewSummaryText: {
        ...GlobalStyles.text,
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
    },
})
