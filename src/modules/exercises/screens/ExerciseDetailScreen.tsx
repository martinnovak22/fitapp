import { Spacing } from '@/src/constants/Spacing'
import { getRepositories } from '@/src/data/repositories'
import { Exercise } from '@/src/db/exercises'
import {
    ExerciseStats,
    type BestSetEntry,
    type SessionSummary,
} from '@/src/modules/exercises/ExerciseStats'
import type { PrimaryMetric } from '@/src/modules/exercises/ExerciseTypeMetadata'
import { Card } from '@/src/modules/core/components/Card'
import { Button } from '@/src/modules/core/components/Button'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { FullScreenImageModal } from '@/src/modules/core/components/FullScreenImageModal'
import { ScreenHeader } from '@/src/modules/core/components/ScreenHeader'
import { ScreenLayout, ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { showToast } from '@/src/modules/core/utils/toast'
import { formatExerciseType, formatMuscleGroup } from '@/src/utils/formatters'
import { useIsFocused } from '@react-navigation/native'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Image, StyleSheet, TouchableOpacity, View } from 'react-native'
import { ExerciseHistoryGraph } from './components/ExerciseHistoryGraph'

export default function ExerciseDetailScreen() {
    const { exercises: exerciseRepo } = getRepositories()
    const { t } = useTranslation()
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

    if (isLoading && !exercise) {
        return (
            <ScreenLayout style={styles.centeredScreen}>
                <ActivityIndicator size={"large"} color={theme.primary} />
                <Typography.Body style={styles.loadingText}>{t('loading')}</Typography.Body>
            </ScreenLayout>
        )
    }

    if (loadError && !exercise) {
        return (
            <ScreenLayout style={styles.centeredScreen}>
                <Card>
                    <EmptyState message={loadError} icon={"exclamation-circle"} style={{ backgroundColor: theme.surface }} />
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

    const handleDelete = () => {
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
    }

    return (
        <ScrollScreenLayout
            style={{ paddingTop: 0 }}
            contentContainerStyle={{ paddingTop: 0, paddingBottom: Spacing.lg }}
            nestedScrollEnabled={true}
            fixedHeader={
                <ScreenHeader
                    title={exercise.name}
                    onDelete={handleDelete}
                    rightAction={{
                        label: t('edit'),
                        onPress: () => router.push(`/(tabs)/exercises/edit/${exercise.id}`),
                    }}
                />
            }
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
                        <View>
                            <Typography.Label>{t('type')}</Typography.Label>
                            <Typography.Body>{t(formatExerciseType(exercise.type))}</Typography.Body>
                        </View>
                        <View>
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
                        <ActivityIndicator size={"small"} color={theme.primary} />
                        <Typography.Meta style={styles.loadingText}>{t('loading')}</Typography.Meta>
                    </View>
                ) : historyError ? (
                    <View style={styles.historyError}>
                        <EmptyState message={historyError} icon={"line-chart"} style={{ backgroundColor: theme.surface }} />
                        <Button
                            label={t('retry')}
                            onPress={() => loadHistory(exercise.id)}
                            variant={"outline"}
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
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
    },

    photo: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
})
