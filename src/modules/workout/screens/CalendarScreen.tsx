import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import { getRepositories } from '@/src/data/repositories'
import { useReloadOnSyncSuccess } from '@/src/data/sync/useReloadOnSyncSuccess'
import type { Workout } from '@/src/db/workouts'
import { Button } from '@/src/modules/core/components/Button'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { useStaleGuard } from '@/src/modules/core/hooks/useStaleGuard'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { showToast } from '@/src/modules/core/utils/toast'
import { formatLocalDateYYYYMMDD } from '@/src/utils/dateTime'
import { CalendarCard, type MarkedDates } from './components/CalendarCard'
import { CalendarDayDetail } from './components/CalendarDayDetail'
import { WorkoutSummaryModal } from './components/WorkoutSummaryModal'

export default function CalendarScreen() {
    const { workouts: workoutRepo } = getRepositories()
    const { t } = useTranslation()
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

    const beginLoad = useStaleGuard()

    const loadWorkouts = useCallback(async () => {
        // Focus and the post-sync reload can race; only the most recent run
        // may commit, or a stale read taken while sync was still writing
        // would overwrite the fresh calendar.
        const isStale = beginLoad()
        setLoadError(null)
        setIsLoading(true)
        try {
            const all = await workoutRepo.getAllWorkouts()
            if (isStale()) return

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
            if (!isStale()) setLoadError(t('failedToLoadCalendar'))
        } finally {
            if (!isStale()) setIsLoading(false)
        }
    }, [beginLoad, selectedDate, t, theme.primary, workoutRepo])

    useFocusEffect(
        useCallback(() => {
            loadWorkouts()
        }, [loadWorkouts])
    )

    // Reflect rows a background sync just pulled (e.g. right after login)
    // without making the user pull to refresh.
    useReloadOnSyncSuccess(loadWorkouts)

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
            router.push(`/(tabs)/workout/${id}`)
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
            <CalendarCard markedDates={markedDates} selectedDate={selectedDate} onDayPress={handleDayPress} />

            {selectedDate && (
                <CalendarDayDetail
                    selectedDate={selectedDate}
                    dayWorkouts={dayWorkouts}
                    onOpenSummary={handleOpenSummary}
                />
            )}

            <WorkoutSummaryModal
                workout={modalWorkout}
                workoutSets={workoutSets}
                isLoadingSummary={isLoadingSummary}
                onClose={() => setModalWorkout(null)}
                onViewHistory={handleViewHistory}
            />
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
    headerBack: {
        paddingLeft: Spacing.md,
        paddingRight: Spacing.sm,
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
    },
})
