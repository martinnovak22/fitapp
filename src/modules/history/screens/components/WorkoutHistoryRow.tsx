import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router } from 'expo-router'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import type { Workout } from '@/src/db/workouts'
import { groupedRowCorners } from '@/src/modules/core/components/ListSection'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { workoutMinutes } from '@/src/modules/workout/weekSummary'
import { formatHourMinute, formatLocalizedDate, parseLocalDate } from '@/src/utils/dateTime'
import { formatWorkoutLength } from '@/src/utils/formatters'
import type { WorkoutRowSummary } from '../../historySummary'

type WorkoutHistoryRowProps = {
    workout: Workout
    summary: WorkoutRowSummary | undefined
    // The Template a Planned Workout came from, if it still exists.
    templateName: string | undefined
    // False under a day's heading (the calendar), where the date is already shown.
    showDate?: boolean
    index: number
    count: number
}

// One Workout in the history list: its Template (or, for an Unplanned
// Workout, its date), how long, how much, and its main exercises. Opens the workout detail.
function WorkoutHistoryRowInner({
    workout,
    summary,
    templateName,
    showDate = true,
    index,
    count,
}: WorkoutHistoryRowProps) {
    const { t, i18n } = useTranslation()
    const { theme } = useTheme()
    const inProgress = workout.status !== 'finished'
    const date = formatLocalizedDate(
        parseLocalDate(workout.date),
        i18n.language,
        { weekday: 'short', day: 'numeric', month: 'short' },
        true
    )
    // The start time tells apart several Workouts on one day.
    const time = workout.start_time ? formatHourMinute(workout.start_time, i18n.language) : null
    const when = [showDate ? date : null, time].filter(Boolean).join(' · ')
    // A Template names the Workout; an Unplanned one is named by when it started.
    const facts = [
        templateName ? when : null,
        inProgress ? null : formatWorkoutLength(workoutMinutes(workout), t('min')),
        t('setsCount', { count: summary?.setCount ?? 0 }),
        summary && summary.volumeKg > 0
            ? `${Math.round(summary.volumeKg).toLocaleString(i18n.language)} ${t('kg')}`
            : null,
    ].filter(Boolean)

    return (
        <TouchableOpacity
            onPress={() => router.push(`/(tabs)/history/${workout.id}`)}
            activeOpacity={0.6}
            style={[styles.row, { backgroundColor: theme.surface }, ...groupedRowCorners(index, count)]}
            accessibilityRole={'button'}
        >
            <View
                style={[
                    styles.inner,
                    index > 0 && { borderTopColor: theme.hairline, borderTopWidth: StyleSheet.hairlineWidth },
                ]}
            >
                <View style={styles.text}>
                    <View style={styles.titleRow}>
                        <Typography.Body weight={'semibold'} numberOfLines={1} style={styles.title}>
                            {templateName ?? when}
                        </Typography.Body>
                        {inProgress && (
                            <Typography.Meta color={'primary'} weight={'bold'}>
                                {t('inProgress')}
                            </Typography.Meta>
                        )}
                    </View>
                    <Typography.Label color={'textSecondary'} numeric numberOfLines={1}>
                        {facts.join(' · ')}
                    </Typography.Label>
                    {summary && summary.topExercises.length > 0 && (
                        <Typography.Meta color={'textSecondary'} numberOfLines={1}>
                            {summary.topExercises.join(', ')}
                        </Typography.Meta>
                    )}
                </View>
                <FontAwesome name={'angle-right'} size={20} color={theme.textSecondary} />
            </View>
        </TouchableOpacity>
    )
}

export const WorkoutHistoryRow = memo(WorkoutHistoryRowInner)

const styles = StyleSheet.create({
    row: {
        paddingLeft: Spacing.md,
    },
    inner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.sm + Spacing.xs,
        paddingRight: Spacing.md,
        minHeight: 64,
    },
    text: {
        flex: 1,
        minWidth: 0,
        gap: Spacing.xs2,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    title: {
        flexShrink: 1,
    },
})
