import { useFocusEffect, useNavigation } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import { useWorkoutRepo } from '@/src/data/RepositoryContext'
import { useReloadOnSyncSuccess } from '@/src/data/sync/useReloadOnSyncSuccess'
import type { Workout } from '@/src/db/workouts'
import { Button } from '@/src/modules/core/components/Button'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { useRevealOnce } from '@/src/modules/core/hooks/useRevealOnce'
import { useStaleGuard } from '@/src/modules/core/hooks/useStaleGuard'
import { shouldShowSkeleton } from '@/src/modules/core/utils/loadingGate'
import { log } from '@/src/modules/core/utils/logger'
import { HistoryListSkeleton } from './components/HistoryListSkeleton'
import { WorkoutHistoryCard } from './components/WorkoutHistoryCard'

export default function HistoryScreen() {
    const workoutRepo = useWorkoutRepo()
    const { t } = useTranslation()
    const navigation = useNavigation()
    const [workouts, setWorkouts] = useState<Workout[]>([])
    const [initialLoading, setInitialLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [refreshing, setRefreshing] = useState(false)
    const animatedItemIdsRef = useRef<Set<number>>(new Set())
    // The skeleton is the screen's entrance. Once the list first loads, don't
    // float that initial batch in on top of it — that reads as a flash. Items
    // that first appear later (e.g. a just-finished workout) still animate.
    const hasRevealed = useRevealOnce(!initialLoading)

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

    const renderItem = ({ item, index }: { item: Workout; index: number }) => {
        const firstSeen = !animatedItemIdsRef.current.has(item.id)
        if (firstSeen) {
            animatedItemIdsRef.current.add(item.id)
        }
        const canAnimate = hasRevealed.current && firstSeen && index < 8
        return <WorkoutHistoryCard item={item} index={index} canAnimate={canAnimate} />
    }

    // isHydrating and hasLoadedOnce are hardcoded placeholders: History only
    // tracks a single one-way initialLoading flag today, so this reduces to
    // initialLoading for now, but documents the shape #78 will wire real
    // hydration/latch state into once it extracts a dedicated hook.
    const showSkeleton = shouldShowSkeleton({ isHydrating: false, isLoading: initialLoading, hasLoadedOnce: false })

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
                <FlatList
                    data={workouts}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
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
