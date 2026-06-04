import { useFocusEffect, useNavigation } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import { getRepositories } from '@/src/data/repositories'
import type { Workout } from '@/src/db/workouts'
import { Button } from '@/src/modules/core/components/Button'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { WorkoutHistoryCard } from './components/WorkoutHistoryCard'

export default function HistoryScreen() {
    const { workouts: workoutRepo } = getRepositories()
    const { t } = useTranslation()
    const { theme } = useTheme()
    const navigation = useNavigation()
    const [workouts, setWorkouts] = useState<Workout[]>([])
    const [initialLoading, setInitialLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [refreshing, setRefreshing] = useState(false)
    const animatedItemIdsRef = useRef<Set<number>>(new Set())

    useFocusEffect(
        useCallback(() => {
            navigation.getParent()?.setOptions({
                headerLeft: () => null,
                headerRight: () => null,
            })
        }, [navigation])
    )

    const loadData = useCallback(
        async (showRefresh = false) => {
            if (showRefresh) setRefreshing(true)
            setLoadError(null)
            try {
                const data = await workoutRepo.getAllWorkouts()
                setWorkouts(data)
            } catch (error) {
                console.error('Failed to load workouts history:', error)
                setLoadError(t('failedToLoadWorkouts'))
            } finally {
                if (showRefresh) setRefreshing(false)
                setInitialLoading(false)
            }
        },
        [t, workoutRepo]
    )

    useFocusEffect(
        useCallback(() => {
            loadData(false)
        }, [loadData])
    )

    const onRefresh = async () => {
        await loadData(true)
    }

    const renderItem = ({ item, index }: { item: Workout; index: number }) => {
        const canAnimate = index < 8 && !animatedItemIdsRef.current.has(item.id)
        if (canAnimate) {
            animatedItemIdsRef.current.add(item.id)
        }
        return <WorkoutHistoryCard item={item} index={index} canAnimate={canAnimate} />
    }

    return (
        <ScreenLayout>
            {initialLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size={'large'} color={theme.primary} />
                </View>
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
