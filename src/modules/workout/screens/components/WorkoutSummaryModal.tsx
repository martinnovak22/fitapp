import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import { GlobalStyles } from '@/src/constants/Styles'
import { FontSize, FontWeight } from '@/src/constants/Typography'
import type { Workout } from '@/src/db/workouts'
import { Button } from '@/src/modules/core/components/Button'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { formatHourMinute, formatLocalizedDate } from '@/src/utils/dateTime'

interface WorkoutSummaryModalProps {
    workout: Workout | null
    workoutSets: { exercise_name: string; count: number }[]
    isLoadingSummary: boolean
    onClose: () => void
    onViewHistory: () => void
}

// The per-workout summary modal: header date/time, the set-count list (with its
// loading and empty branches), and the footer actions.
export function WorkoutSummaryModal({
    workout,
    workoutSets,
    isLoadingSummary,
    onClose,
    onViewHistory,
}: WorkoutSummaryModalProps) {
    const { t, i18n } = useTranslation()
    const { theme } = useTheme()

    return (
        <Modal animationType="fade" transparent={true} visible={!!workout} onRequestClose={onClose}>
            <TouchableOpacity
                style={[styles.modalOverlay, { backgroundColor: theme.overlayScrim }]}
                activeOpacity={1}
                onPress={onClose}
            >
                <View
                    style={[
                        styles.modalContent,
                        { backgroundColor: theme.surface, borderColor: theme.inputBackgroundActive },
                    ]}
                >
                    <Typography.Title style={[styles.modalTitle, { color: theme.text }]}>
                        {t('workoutSummary')}
                    </Typography.Title>
                    {workout && (
                        <Typography.Meta style={[styles.modalDate, { color: theme.textSecondary }]}>
                            {formatLocalizedDate(workout.date, i18n.language, {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })}
                            {' - '}
                            {formatHourMinute(workout.start_time)}
                            {workout.end_time
                                ? ` - ${formatHourMinute(workout.end_time)}`
                                : ` (${t('inProgress')})`}
                        </Typography.Meta>
                    )}

                    <ScrollView style={styles.summaryScroll} contentContainerStyle={styles.summaryScrollContent}>
                        {isLoadingSummary ? (
                            <View style={styles.summaryLoading}>
                                <ActivityIndicator size={'small'} color={theme.primary} />
                            </View>
                        ) : workoutSets.length > 0 ? (
                            workoutSets.map((item, index) => (
                                <View
                                    key={index.toString()}
                                    style={[styles.summaryRow, { borderBottomColor: theme.inputBackground }]}
                                >
                                    <Typography.Body style={[styles.summaryText, { color: theme.text }]}>
                                        {item.exercise_name}
                                    </Typography.Body>
                                    <Typography.Body style={[styles.summaryCount, { color: theme.primary }]}>
                                        {item.count} {t('sets')}
                                    </Typography.Body>
                                </View>
                            ))
                        ) : (
                            <Typography.Body style={[styles.emptySummary, { color: theme.textSecondary }]}>
                                {t('noSetsRecorded')}
                            </Typography.Body>
                        )}
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <Button label={t('close')} onPress={onClose} variant="secondary"  />
                        <Button label={t('viewHistory')} onPress={onViewHistory}  />
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    )
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        maxHeight: '70%',
        borderRadius: Spacing.md,
        padding: Spacing.lg,
        borderWidth: 1,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    modalTitle: {
        ...GlobalStyles.subtitle,
        marginBottom: Spacing.xs,
    },
    modalDate: {
        ...GlobalStyles.text,
        fontSize: FontSize.sm,
        marginBottom: Spacing.lg,
    },
    summaryScroll: {
        marginBottom: Spacing.lg,
        maxHeight: 300,
    },
    summaryScrollContent: {
        paddingVertical: Spacing.xs,
    },
    summaryLoading: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.lg,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
    },
    summaryText: {
        ...GlobalStyles.text,
        flex: 1,
    },
    summaryCount: {
        ...GlobalStyles.text,
        fontWeight: FontWeight.bold,
        marginLeft: Spacing.md,
    },
    emptySummary: {
        ...GlobalStyles.text,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: Spacing.lg,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: Spacing.md,
    },
})
