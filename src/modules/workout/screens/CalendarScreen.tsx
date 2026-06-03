import { Spacing } from '@/src/constants/Spacing'
import { GlobalStyles } from '@/src/constants/Styles'
import { FontSize, FontWeight } from '@/src/constants/Typography'
import { getRepositories } from '@/src/data/repositories'
import { Workout } from '@/src/db/workouts'
import { Button } from '@/src/modules/core/components/Button'
import { Card } from '@/src/modules/core/components/Card'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { showToast } from '@/src/modules/core/utils/toast'
import { formatHourMinute, formatLocalDateYYYYMMDD, formatLocalizedDate } from '@/src/utils/dateTime'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Calendar } from 'react-native-calendars'
import Animated from 'react-native-reanimated'
import { Motion } from '@/src/constants/Motion'

// Hoisted builders (don't allocate these in render). The populated list and the
// empty state share one entrance, so selecting any day animates the same way
// instead of the empty state jumping in.
const DAY_DETAIL_ENTER = Motion.screenEnter().delay(140)
const DAY_DETAIL_EXIT = Motion.fadeOutDown()
const CALENDAR_CARD_ENTER = Motion.screenEnter().delay(70)

interface MarkedDates {
    [date: string]: {
        marked?: boolean
        selected?: boolean
        selectedColor?: string
        dotColor?: string
    }
}

export default function CalendarScreen() {
    const { workouts: workoutRepo } = getRepositories()
    const { t, i18n } = useTranslation()
    const { theme } = useTheme()
    const navigation = useNavigation()

    useFocusEffect(
        useCallback(() => {
            navigation.getParent()?.setOptions({
                headerTitle: t('calendar'),
                headerLeft: () => (
                    <TouchableOpacity
                        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/workout'))}
                        style={styles.headerBack}
                        accessibilityRole={'button'}
                        accessibilityLabel={t('back')}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                        <FontAwesome name={'chevron-left'} size={20} color={theme.text} />
                    </TouchableOpacity>
                ),
                headerRight: () => null,
            })
        }, [navigation, theme, t])
    )
    const [workouts, setWorkouts] = useState<Workout[]>([])
    const [markedDates, setMarkedDates] = useState<MarkedDates>({})
    const [selectedDate, setSelectedDate] = useState<string | null>(formatLocalDateYYYYMMDD())
    const [dayWorkouts, setDayWorkouts] = useState<Workout[]>([])
    const [modalWorkout, setModalWorkout] = useState<Workout | null>(null)
    const [workoutSets, setWorkoutSets] = useState<{ exercise_name: string; count: number }[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingSummary, setIsLoadingSummary] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)

    const loadWorkouts = useCallback(async () => {
        setLoadError(null)
        setIsLoading(true)
        try {
            const all = await workoutRepo.getAllWorkouts()
            setWorkouts(all)

            const marked: MarkedDates = {}
            all.forEach((w) => {
                marked[w.date] = {
                    marked: true,
                    dotColor: theme.primary,
                }
            })
            setMarkedDates(marked)

            if (selectedDate) {
                setDayWorkouts(all.filter((w) => w.date === selectedDate))
            }
        } catch (error) {
            console.error('Failed to load calendar workouts:', error)
            setLoadError(t('failedToLoadCalendar'))
        } finally {
            setIsLoading(false)
        }
    }, [selectedDate, t, theme.primary, workoutRepo])

    useFocusEffect(
        useCallback(() => {
            loadWorkouts()
        }, [loadWorkouts])
    )

    const handleDayPress = (day: { dateString: string }) => {
        setSelectedDate(day.dateString)
        setDayWorkouts(workouts.filter((w) => w.date === day.dateString))
    }

    const handleOpenSummary = async (workout: Workout) => {
        setModalWorkout(workout)
        setIsLoadingSummary(true)
        try {
            const sets = await workoutRepo.getSets(workout.id)
            const summary = sets.reduce(
                (acc, s) => {
                    const existing = acc.find((item) => item.exercise_name === s.exercise_name)
                    if (existing) {
                        existing.count++
                    } else {
                        acc.push({ exercise_name: s.exercise_name, count: 1 })
                    }
                    return acc
                },
                [] as { exercise_name: string; count: number }[]
            )
            setWorkoutSets(summary)
        } catch (error) {
            console.error('Failed to load workout summary:', error)
            setWorkoutSets([])
            showToast.danger({ title: t('error'), message: t('failedToLoadWorkoutSummary') })
        } finally {
            setIsLoadingSummary(false)
        }
    }

    const handleViewHistory = () => {
        if (modalWorkout) {
            const id = modalWorkout.id
            setModalWorkout(null)
            router.replace(`/(tabs)/history/${id}`)
        }
    }

    if (isLoading && workouts.length === 0) {
        return (
            <ScrollScreenLayout contentContainerStyle={styles.scrollContent} style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size={'large'} color={theme.primary} />
                </View>
            </ScrollScreenLayout>
        )
    }

    if (loadError && workouts.length === 0) {
        return (
            <ScrollScreenLayout contentContainerStyle={styles.scrollContent} style={styles.container}>
                <View style={styles.loadingContainer}>
                    <EmptyState message={loadError} icon={'exclamation-circle'} />
                    <Button label={t('retry')} onPress={loadWorkouts} style={{ marginTop: Spacing.md }} />
                </View>
            </ScrollScreenLayout>
        )
    }

    return (
        <ScrollScreenLayout contentContainerStyle={styles.scrollContent} style={styles.container}>
            <Animated.View entering={CALENDAR_CARD_ENTER}>
                <Card style={styles.calendarCard}>
                    <Calendar
                        theme={{
                            backgroundColor: 'transparent',
                            calendarBackground: 'transparent',
                            textSectionTitleColor: theme.textSecondary,
                            selectedDayBackgroundColor: theme.primary,
                            selectedDayTextColor: theme.onPrimary,
                            todayTextColor: theme.primary,
                            dayTextColor: theme.text,
                            textDisabledColor: theme.inputBackgroundActive,
                            dotColor: theme.primary,
                            selectedDotColor: theme.onPrimary,
                            arrowColor: theme.primary,
                            disabledArrowColor: theme.border,
                            monthTextColor: theme.text,
                            indicatorColor: theme.primary,
                            textDayFontFamily: 'System',
                            textMonthFontFamily: 'System',
                            textDayHeaderFontFamily: 'System',
                            textDayFontWeight: '300',
                            textMonthFontWeight: 'bold',
                            textDayHeaderFontWeight: '300',
                            textDayFontSize: 16,
                            textMonthFontSize: 18,
                            textDayHeaderFontSize: 14,
                        }}
                        markedDates={{
                            ...markedDates,
                            ...(selectedDate
                                ? {
                                      [selectedDate]: {
                                          ...markedDates[selectedDate],
                                          selected: true,
                                          selectedColor: theme.primary + '40',
                                      },
                                  }
                                : {}),
                        }}
                        onDayPress={handleDayPress}
                        hideExtraDays={false}
                        showSixWeeks={true}
                    />
                </Card>
            </Animated.View>

            {selectedDate &&
                (dayWorkouts.length > 0 ? (
                    <Animated.View key={`${selectedDate}-list`} entering={DAY_DETAIL_ENTER} exiting={DAY_DETAIL_EXIT}>
                        <Typography.Subtitle style={[styles.dayHeader, { color: theme.text }]}>
                            {formatLocalizedDate(
                                selectedDate,
                                i18n.language,
                                { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
                                true
                            )}
                        </Typography.Subtitle>

                        {dayWorkouts.map((w, index) => (
                            <Animated.View key={w.id} entering={Motion.listItem(index)}>
                                <Card
                                    style={styles.workoutCard}
                                    onPress={() => handleOpenSummary(w)}
                                    accessibilityLabel={`${formatHourMinute(w.start_time)} ${w.end_time ? `- ${formatHourMinute(w.end_time)}` : t('inProgress')}`}
                                    accessibilityHint={t('viewSummary')}
                                >
                                    <View style={styles.workoutCardRow}>
                                        <View>
                                            <Typography.Body style={[styles.workoutTime, { color: theme.text }]}>
                                                {formatHourMinute(w.start_time)}{' '}
                                                {w.end_time
                                                    ? `- ${formatHourMinute(w.end_time)}`
                                                    : `(${t('inProgress')})`}
                                            </Typography.Body>
                                            <Typography.Meta
                                                style={[styles.workoutStatus, { color: theme.textSecondary }]}
                                            >
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
                ) : (
                    <Animated.View key={`${selectedDate}-empty`} entering={DAY_DETAIL_ENTER} exiting={DAY_DETAIL_EXIT}>
                        <Typography.Subtitle style={[styles.dayHeader, { color: theme.text }]}>
                            {formatLocalizedDate(
                                selectedDate,
                                i18n.language,
                                { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
                                true
                            )}
                        </Typography.Subtitle>
                        <EmptyState message={t('noWorkoutsRecorded')} icon={'calendar-o'} />
                    </Animated.View>
                ))}

            <Modal
                animationType="fade"
                transparent={true}
                visible={!!modalWorkout}
                onRequestClose={() => setModalWorkout(null)}
            >
                <TouchableOpacity
                    style={[styles.modalOverlay, { backgroundColor: theme.overlayScrim }]}
                    activeOpacity={1}
                    onPress={() => setModalWorkout(null)}
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
                        {modalWorkout && (
                            <Typography.Meta style={[styles.modalDate, { color: theme.textSecondary }]}>
                                {formatLocalizedDate(modalWorkout.date, i18n.language, {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                })}
                                {' - '}
                                {formatHourMinute(modalWorkout.start_time)}
                                {modalWorkout.end_time
                                    ? ` - ${formatHourMinute(modalWorkout.end_time)}`
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
                            <Button
                                label={t('close')}
                                onPress={() => setModalWorkout(null)}
                                variant="secondary"
                                style={{ flex: 1 }}
                            />
                            <Button label={t('viewHistory')} onPress={handleViewHistory} style={{ flex: 1 }} />
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </ScrollScreenLayout>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: Spacing.xl2,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    calendarCard: {
        padding: Spacing.sm,
        marginBottom: Spacing.lg,
        height: 380,
    },
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
    headerBack: {
        paddingLeft: Spacing.md,
        paddingRight: Spacing.sm,
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
    },
})
