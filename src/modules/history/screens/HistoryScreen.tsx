import { useFocusEffect, useNavigation } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshControl, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { Motion } from '@/src/constants/Motion'
import { Spacing } from '@/src/constants/Spacing'
import { useWorkoutRepo } from '@/src/data/RepositoryContext'
import { useReloadOnSyncSuccess } from '@/src/data/sync/useReloadOnSyncSuccess'
import type { Workout } from '@/src/db/workouts'
import { Button } from '@/src/modules/core/components/Button'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { useMinimumSkeleton } from '@/src/modules/core/hooks/useMinimumSkeleton'
import { useStaleGuard } from '@/src/modules/core/hooks/useStaleGuard'
import { shouldShowSkeleton } from '@/src/modules/core/utils/loadingGate'
import { log } from '@/src/modules/core/utils/logger'
import { HistoryListSkeleton } from './components/HistoryListSkeleton'
import { WorkoutHistoryCard } from './components/WorkoutHistoryCard'

// Slide rows into place when the list changes (e.g. a new workout lands at the
// top) instead of the content jumping. Layout-only — not an entrance float-in.
const LIST_LAYOUT = Motion.layout()

export default function HistoryScreen() {
    const workoutRepo = useWorkoutRepo()
    const { t } = useTranslation()
    const navigation = useNavigation()
    const [workouts, setWorkouts] = useState<Workout[]>([])
    const [initialLoading, setInitialLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [refreshing, setRefreshing] = useState(false)

    useFocusEffect(
        useCallback(() => {
            navigation.getParent()?.setOptions({
                headerLeft: () => null,
                headerRight: () => null,
            })
        }, [navigation])
    )

    const beginLoad = useStaleGuard()

    const loadData = useCallback(
        async (showRefresh = false) => {
            // Focus, pull-to-refresh, and the post-sync reload can race; only
            // the most recent run may commit, or a stale read taken while sync
            // was still writing would overwrite the fresh list.
            const isStale = beginLoad()
            if (showRefresh) setRefreshing(true)
            setLoadError(null)
            try {
                const data = await workoutRepo.getAllWorkouts()
                if (!isStale()) setWorkouts(data)
            } catch (error) {
                log('error', 'Failed to load workouts history', error)
                if (!isStale()) setLoadError(t('failedToLoadWorkouts'))
            } finally {
                if (!isStale()) {
                    if (showRefresh) setRefreshing(false)
                    setInitialLoading(false)
                }
            }
        },
        [beginLoad, t, workoutRepo]
    )

    useFocusEffect(
        useCallback(() => {
            loadData(false)
        }, [loadData])
    )

    // Reflect rows a background sync just pulled (e.g. right after login)
    // without making the user pull to refresh.
    useReloadOnSyncSuccess(useCallback(() => void loadData(false), [loadData]))

    const onRefresh = async () => {
        await loadData(true)
    }

    const renderItem = ({ item }: { item: Workout }) => <WorkoutHistoryCard item={item} />

    // The skeleton is the screen's entrance; the list then renders statically
    // (no per-item float-in). isHydrating/hasLoadedOnce are hardcoded: History
    // tracks a single one-way initialLoading flag, so this reduces to it today.
    // useMinimumSkeleton holds the skeleton briefly so a cached load doesn't
    // flash it for a few frames.
    const showSkeleton = useMinimumSkeleton(
        shouldShowSkeleton({ isHydrating: false, isLoading: initialLoading, hasLoadedOnce: false })
    )

    return (
        <ScreenLayout>
            {showSkeleton ? (
                <HistoryListSkeleton />
            ) : loadError && workouts.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <EmptyState message={loadError} icon={'exclamation-circle'} />
                    <Button label={t('retry')} onPress={onRefresh} style={{ marginTop: Spacing.md }} />
                </View>
            ) : (
                <Animated.FlatList
                    data={workouts}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    itemLayoutAnimation={LIST_LAYOUT}
                    contentContainerStyle={styles.listPadding}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <EmptyState
                            message={t('noWorkoutsYet')}
                            subMessage={t('addFirstWorkout')}
                            icon={'calendar-o'}
                        />
                    }
                />
            )}
        </ScreenLayout>
    )
}
const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listPadding: {
        paddingBottom: Spacing.lg,
    },
})
