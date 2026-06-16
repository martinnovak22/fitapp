import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import { useExerciseRepo } from '@/src/data/RepositoryContext'
import { useReloadOnSyncSuccess } from '@/src/data/sync/useReloadOnSyncSuccess'
import type { Exercise } from '@/src/db/exercises'
import { Button } from '@/src/modules/core/components/Button'
import { Card } from '@/src/modules/core/components/Card'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { FullScreenImageModal } from '@/src/modules/core/components/FullScreenImageModal'
import { Appear } from '@/src/modules/core/components/motion'
import { ScreenLayout, ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useStaleGuard } from '@/src/modules/core/hooks/useStaleGuard'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { log } from '@/src/modules/core/utils/logger'
import { showToast } from '@/src/modules/core/utils/toast'
import { type BestSetEntry, ExerciseStats, type SessionSummary } from '@/src/modules/exercises/ExerciseStats'
import type { PrimaryMetric } from '@/src/modules/exercises/ExerciseTypeMetadata'
import { ExerciseHistorySection } from './components/ExerciseHistorySection'
import { ExerciseInfoRow } from './components/ExerciseInfoRow'

export default function ExerciseDetailScreen() {
    const exerciseRepo = useExerciseRepo()
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
    const { theme } = useTheme()
    const beginLoad = useStaleGuard()

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
                log('error', 'Failed to load exercise history', error)
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
        const isStale = beginLoad()
        setIsLoading(true)
        setLoadError(null)

        try {
            if (!id) {
                if (isStale()) return
                setExercise(null)
                setHistoryData([])
                setHistorySummary(null)
                setDominantMetric(null)
                setLoadError(t('failedToLoadExerciseDetails'))
                return
            }

            const nextExercise = await exerciseRepo.getById(Number(id))
            if (isStale()) return
            if (!nextExercise) {
                router.replace('/(tabs)/exercises')
                return
            }

            setExercise(nextExercise)
            await loadHistory(nextExercise.id)
        } catch (error) {
            if (isStale()) return
            log('error', 'Failed to load exercise detail', error)
            setExercise(null)
            setHistoryData([])
            setHistorySummary(null)
            setLoadError(t('failedToLoadExerciseDetails'))
        } finally {
            if (!isStale()) setIsLoading(false)
        }
    }, [beginLoad, exerciseRepo, id, loadHistory, t])

    useFocusEffect(
        useCallback(() => {
            loadData()
        }, [loadData])
    )

    // Reflect data a background sync just pulled (e.g. right after login)
    // without making the user pull to refresh.
    useReloadOnSyncSuccess(loadData)

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
                        <Appear style={styles.headerActions}>
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
                        </Appear>
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
            <Card style={{ marginTop: Spacing.md, gap: Spacing.md }}>
                <ExerciseInfoRow exercise={exercise} onOpenPhoto={() => setShowImageFullScreen(true)} />
                <ExerciseHistorySection
                    exercise={exercise}
                    historyData={historyData}
                    historySummary={historySummary}
                    dominantMetric={dominantMetric}
                    historyLoading={historyLoading}
                    historyError={historyError}
                    onRetry={() => loadHistory(exercise.id)}
                />
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
    retryButton: {
        marginTop: Spacing.md,
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
