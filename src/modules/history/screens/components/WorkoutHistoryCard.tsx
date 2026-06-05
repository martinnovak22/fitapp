import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { Motion } from '@/src/constants/Motion'
import { Spacing } from '@/src/constants/Spacing'
import { FontSize, FontWeight } from '@/src/constants/Typography'
import type { Workout } from '@/src/db/workouts'
import { Card } from '@/src/modules/core/components/Card'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { formatHourMinute, formatLocalizedDate } from '@/src/utils/dateTime'

interface WorkoutHistoryCardProps {
    item: Workout
    index: number
    canAnimate: boolean
}

// One row of the workout-history list. Owns the date/time formatting and all the
// status/note conditional rendering so the screen's renderItem stays a thin
// wrapper around the first-N-items animation bookkeeping.
export function WorkoutHistoryCard({ item, index, canAnimate }: WorkoutHistoryCardProps) {
    const { t, i18n } = useTranslation()
    const { theme } = useTheme()

    const formattedDate = formatLocalizedDate(
        item.date,
        i18n.language,
        { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
        true
    )

    return (
        <Animated.View entering={canAnimate ? Motion.listItem(index) : undefined}>
            <Card
                onPress={() => router.push(`/(tabs)/history/${item.id}`)}
                style={styles.workoutCard}
                accessibilityLabel={`${formattedDate}, ${item.status === 'finished' ? t('completed') : t('inProgress')}`}
                accessibilityHint={t('viewSummary')}
            >
                <View style={styles.workoutItem}>
                    <View style={styles.workoutInfo}>
                        <Typography.Body style={styles.workoutDate} numberOfLines={1}>
                            {formattedDate}
                        </Typography.Body>
                        <Typography.Meta style={styles.workoutTime}>
                            {item.start_time ? formatHourMinute(item.start_time) : ''}
                            {item.end_time ? ` - ${formatHourMinute(item.end_time)}` : ` (${t('inProgress')})`}
                        </Typography.Meta>
                        {item.note && (
                            <Typography.Meta style={styles.workoutNote}>
                                {'"'}
                                {item.note}
                                {'"'}
                            </Typography.Meta>
                        )}
                    </View>
                    <FontAwesome
                        name={item.status === 'finished' ? 'check-circle' : 'clock-o'}
                        size={20}
                        color={item.status === 'finished' ? theme.primary : theme.secondary}
                    />
                </View>
            </Card>
        </Animated.View>
    )
}

const styles = StyleSheet.create({
    workoutItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 56,
    },
    workoutCard: {
        paddingVertical: Spacing.sm - Spacing.xs2,
        paddingHorizontal: Spacing.md,
    },
    workoutInfo: {
        flex: 1,
        paddingRight: Spacing.md,
    },
    workoutDate: {
        fontWeight: FontWeight.bold,
        fontSize: FontSize.md,
    },
    workoutTime: {
        fontSize: FontSize.xs,
    },
    workoutNote: {
        fontStyle: 'italic',
        marginTop: Spacing.xs,
    },
})
