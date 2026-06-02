import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { getRepositories } from '@/src/data/repositories'
import { Exercise } from '@/src/db/exercises'
import { ExerciseStats, type BestSetEntry, type SessionSummary } from '@/src/modules/exercises/ExerciseStats'
import type { PrimaryMetric } from '@/src/modules/exercises/ExerciseTypeMetadata'
import { Card } from '@/src/modules/core/components/Card'
import { Button } from '@/src/modules/core/components/Button'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { FullScreenImageModal } from '@/src/modules/core/components/FullScreenImageModal'
import { ScreenLayout, ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { showToast } from '@/src/modules/core/utils/toast'
import { formatExerciseType, formatMuscleGroup } from '@/src/utils/formatters'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useIsFocused } from '@react-navigation/native'
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Image, StyleSheet, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { ExerciseHistoryGraph } from './components/ExerciseHistoryGraph'

export default function ExerciseDetailScreen() {
    const { exercises: exerciseRepo } = getRepositories()
    const { t } = useTranslation()
    const navigation = useNavigation()
    const { id } = useLocalSearchParams()
    const [exercise, setExercise] = useState<Exercise | null>(null)
    const [historyData, setHistoryData] = useState<BestSetEntry[]>([])
    const [historySummary, setHistorySummary] = useState<SessionSummary | null>(null)
    const [dominantMetric, setDominantMetric] = useState<PrimaryMetric | null>(null)
    const [showImageFullScreen, setShowImageFullScreen] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [historyLoading, setHistoryLoading] = useState(false)
    const [historyError, setHistoryError] = useState<string | null>(null)
    const isFocused = useIsFocused()
    const { theme } = useTheme()

    const loadHistory = useCallback(
        async (exerciseId: number) => {
            setHistoryLoading(true)
            setHistoryError(null)
            try {
                const [data, summary, dominant] = await Promise.all([
                    ExerciseStats.bestSetPerSession(exerciseId),
                    ExerciseStats.sessionSummary(exerciseId),
                    ExerciseStats.dominantMetric(exerciseId),
                ])
                setHistoryData(data)
                setHistorySummary(summary)
                setDominantMetric(dominant)
            } catch (error) {
                console.error('Failed to load exercise history:', error)
                setHistoryData([])
                setHistorySummary(null)
                setDominantMetric(null)
                setHistoryError(t('failedToLoadHistory'))
            } finally {
                setHistoryLoading(false)
            }
        },
        [t]
    )

    const loadData = useCallback(async () => {
        setIsLoading(true)
        setLoadError(null)

        try {
            if (!id) {
                setExercise(null)
                setHistoryData([])
                setHistorySummary(null)
                setDominantMetric(null)
                setLoadError(t('failedToLoadExerciseDetails'))
                return
            }

            const nextExercise = await exerciseRepo.getById(Number(id))
            if (!nextExercise) {
                router.replace('/(tabs)/exercises')
                return
            }

            setExercise(nextExercise)
            await loadHistory(nextExercise.id)
        } catch (error) {
            console.error('Failed to load exercise detail:', error)
            setExercise(null)
            setHistoryData([])
            setHistorySummary(null)
            setLoadError(t('failedToLoadExerciseDetails'))
        } finally {
            setIsLoading(false)
        }
    }, [exerciseRepo, id, loadHistory, t])

    useEffect(() => {
        if (isFocused) {
            loadData()
        }
    }, [isFocused, loadData])

    const handleDelete = useCallback(() => {
        showToast.confirm({
            title: t('deleteExerciseTitle'),
            message: t('deleteExerciseConfirm'),
            icon: 'trash',
            tone: 'danger',
            action: {
                label: t('delete'),
                onPress: async () => {
                    if (exercise) {
                        await exerciseRepo.delete(exercise.id)
                        router.replace('/(tabs)/exercises')
                        showToast.success({
                            title: t('exerciseDeleted'),
                            message: t('exerciseRemoved'),
                        })
                    }
                },
            },
        })
    }, [exercise, exerciseRepo, t])

    useFocusEffect(
        useCallback(() => {
            navigation.getParent()?.setOptions({
                headerTitle: exercise?.name,
                headerLeft: () => (
                    <TouchableOpacity
                        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/exercises'))}
                        style={styles.headerBack}
                        accessibilityRole={'button'}
                        accessibilityLabel={t('back')}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                        <FontAwesome name={'chevron-left'} size={20} color={theme.text} />
                    </TouchableOpacity>
                ),
                headerRight: () =>
                    exercise ? (
                        <Animated.View entering={FadeIn.duration(180)} style={styles.headerActions}>
                            <TouchableOpacity
                                onPress={() => router.push(`/(tabs)/exercises/edit/${exercise.id}`)}
                                accessibilityRole={'button'}
                                accessibilityLabel={t('edit')}
                                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                            >
                                <FontAwesome name={'pencil'} size={20} color={theme.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleDelete}
                                accessibilityRole={'button'}
                                accessibilityLabel={t('delete')}
                                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                            >
                                <FontAwesome name={'trash'} size={20} color={theme.error} />
                            </TouchableOpacity>
                        </Animated.View>
                    ) : null,
            })
        }, [exercise, navigation, theme, t, handleDelete])
    )

    if (isLoading && !exercise) {
        return (
            <ScreenLayout style={styles.centeredScreen}>
                <ActivityIndicator size={'large'} color={theme.primary} />
                <Typography.Body style={styles.loadingText}>{t('loading')}</Typography.Body>
            </ScreenLayout>
        )
    }

    if (loadError && !exercise) {
        return (
            <ScreenLayout style={styles.centeredScreen}>
                <Card>
                    <EmptyState
                        message={loadError}
                        icon={'exclamation-circle'}
                        style={{ backgroundColor: theme.surface }}
                    />
                    <Button
                        label={t('retry')}
                        onPress={loadData}
                        style={styles.retryButton}
                        accessibilityHint={t('failedToLoadExerciseDetails')}
                    />
                </Card>
            </ScreenLayout>
        )
    }

    if (!exercise) {
        return (
            <ScreenLayout>
                <Typography.Body>{t('loading')}</Typography.Body>
            </ScreenLayout>
        )
    }

    return (
        <ScrollScreenLayout
            style={{ paddingTop: 0 }}
            contentContainerStyle={{ paddingTop: 0, paddingBottom: Spacing.lg }}
            nestedScrollEnabled={true}
        >
            <Card style={{ marginTop: Spacing.md }}>
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        height: 120,
                        marginBottom: Spacing.md,
                    }}
                >
                    <View style={{ flexDirection: 'column', gap: Spacing.md, justifyContent: 'space-between' }}>
                        <View style={{ gap: Spacing.sm }}>
                            <Typography.Label>{t('type')}</Typography.Label>
                            <Typography.Body>{t(formatExerciseType(exercise.type))}</Typography.Body>
                        </View>
                        <View style={{ gap: Spacing.sm }}>
                            <Typography.Label>{t('muscleGroup')}</Typography.Label>
                            <Typography.Body>
                                {exercise.muscle_group ? formatMuscleGroup(exercise.muscle_group) : t('notSpecified')}
                            </Typography.Body>
                        </View>
                    </View>

                    {exercise.photo_uri && (
                        <TouchableOpacity
                            style={[
                                styles.photoContainer,
                                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                            ]}
                            onPress={() => setShowImageFullScreen(true)}
                            activeOpacity={0.9}
                        >
                            <Image key={exercise.photo_uri} source={{ uri: exercise.photo_uri }} style={styles.photo} />
                        </TouchableOpacity>
                    )}
                </View>
                {historyLoading ? (
                    <View style={styles.historyLoading}>
                        <ActivityIndicator size={'small'} color={theme.primary} />
                        <Typography.Meta style={styles.loadingText}>{t('loading')}</Typography.Meta>
                    </View>
                ) : historyError ? (
                    <View style={styles.historyError}>
                        <EmptyState
                            message={historyError}
                            icon={'line-chart'}
                            style={{ backgroundColor: theme.surface }}
                        />
                        <Button
                            label={t('retry')}
                            onPress={() => loadHistory(exercise.id)}
                            variant={'outline'}
                            style={styles.retryButton}
                            accessibilityHint={t('failedToLoadHistory')}
                        />
                    </View>
                ) : historyData.length > 0 ? (
                    <ExerciseHistoryGraph
                        exercise={exercise}
                        data={historyData}
                        summary={historySummary}
                        dominantMetric={dominantMetric}
                    />
                ) : (
                    <EmptyState
                        message={t('statsComingSoon')}
                        icon={'line-chart'}
                        style={{ backgroundColor: theme.surface }}
                    />
                )}
            </Card>
            <FullScreenImageModal
                visible={showImageFullScreen}
                onClose={() => setShowImageFullScreen(false)}
                imageUri={exercise.photo_uri || null}
            />
        </ScrollScreenLayout>
    )
}

const styles = StyleSheet.create({
    centeredScreen: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    loadingText: {
        marginTop: Spacing.xs,
    },
    historyLoading: {
        marginTop: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        minHeight: 120,
    },
    historyError: {
        marginTop: Spacing.md,
    },
    retryButton: {
        marginTop: Spacing.md,
    },
    photoContainer: {
        width: '50%',
        height: 120,
        borderRadius: Radius.md,
        overflow: 'hidden',
        borderWidth: 1,
    },

    photo: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    headerBack: {
        paddingLeft: Spacing.md,
        paddingRight: Spacing.sm,
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        marginRight: Spacing.md,
    },
})
