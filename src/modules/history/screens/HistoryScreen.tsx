import { Spacing } from '@/src/constants/Spacing'
import { getRepositories } from '@/src/data/repositories'
import { Workout } from '@/src/db/workouts'
import { Button } from '@/src/modules/core/components/Button'
import { Card } from '@/src/modules/core/components/Card'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { formatHourMinute, formatLocalizedDate } from '@/src/utils/dateTime'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import React, { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

export default function HistoryScreen() {
    const { workouts: workoutRepo } = getRepositories()
    const { t, i18n } = useTranslation()
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
        const formattedDate = formatLocalizedDate(
            item.date,
            i18n.language,
            { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
            true
        )
        const canAnimate = index < 8 && !animatedItemIdsRef.current.has(item.id)
        if (canAnimate) {
            animatedItemIdsRef.current.add(item.id)
        }

        return (
            <Animated.View entering={canAnimate ? FadeInDown.delay(50 + index * 45).duration(300) : undefined}>
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

    return (
        <ScreenLayout>
            {initialLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size={"large"} color={theme.primary} />
                </View>
            ) : loadError && workouts.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <EmptyState message={loadError} icon={"exclamation-circle"} />
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
        fontWeight: 'bold',
        fontSize: 16,
    },
    workoutTime: {
        fontSize: 13,
    },
    workoutNote: {
        fontStyle: 'italic',
        marginTop: Spacing.xs,
    },
    listPadding: {
        paddingBottom: Spacing.lg,
    },
})
