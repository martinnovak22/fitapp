import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import { useExerciseRepo } from '@/src/data/RepositoryContext'
import { useReloadOnSyncSuccess } from '@/src/data/sync/useReloadOnSyncSuccess'
import type { Exercise } from '@/src/db/exercises'
import { asEquipment, resolveExerciseMuscles } from '@/src/domain/exerciseTaxonomy'
import { Button } from '@/src/modules/core/components/Button'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { FullScreenImageModal } from '@/src/modules/core/components/FullScreenImageModal'
import { InitialsAvatar } from '@/src/modules/core/components/InitialsAvatar'
import { ListRow } from '@/src/modules/core/components/ListRow'
import { ListSection } from '@/src/modules/core/components/ListSection'
import { ScreenLayout, ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { type Segment, SegmentedControl } from '@/src/modules/core/components/SegmentedControl'
import { Typography } from '@/src/modules/core/components/Typography'
import { useStaleGuard } from '@/src/modules/core/hooks/useStaleGuard'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { log } from '@/src/modules/core/utils/logger'
import { type BestSetEntry, ExerciseStats } from '@/src/modules/exercises/ExerciseStats'
import {
    ExerciseTypeMetadata,
    formatCompactSetLabel,
    formatHeadlineStat,
    formatSetWithUnits,
    type PrimaryMetric,
} from '@/src/modules/exercises/ExerciseTypeMetadata'
import { formatLocalizedDate, parseLocalDate } from '@/src/utils/dateTime'
import { type ChartMetric, chartPoints, filterByRange, type HistoryRange, personalRecord } from '../exerciseInsights'
import { equipmentLabel, exerciseMuscleLabel, muscleLabel } from '../taxonomyLabels'
import { ProgressChart } from './components/ProgressChart'

// History rows shown before "Show all".
const HISTORY_PREVIEW = 6

// One Exercise: what it trains, its personal record, progress over time and
// every Workout it was done in. Editing (and deleting) lives in the edit form.
export default function ExerciseDetailScreen() {
    const exerciseRepo = useExerciseRepo()
    const { t, i18n } = useTranslation()
    const navigation = useNavigation()
    const { id } = useLocalSearchParams()
    const { theme } = useTheme()
    const beginLoad = useStaleGuard()
    const [exercise, setExercise] = useState<Exercise | null>(null)
    const [history, setHistory] = useState<BestSetEntry[]>([])
    const [dominantMetric, setDominantMetric] = useState<PrimaryMetric | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showPhoto, setShowPhoto] = useState(false)
    const [range, setRange] = useState<HistoryRange>('3m')
    const [metric, setMetric] = useState<ChartMetric>('best')
    const [showAllHistory, setShowAllHistory] = useState(false)

    const loadData = useCallback(async () => {
        const isStale = beginLoad()
        setIsLoading(true)
        setLoadError(null)
        try {
            const nextExercise = id ? await exerciseRepo.getById(Number(id)) : null
            if (isStale()) return
            if (!nextExercise) {
                router.replace('/(tabs)/exercises')
                return
            }
            const [entries, dominant] = await Promise.all([
                ExerciseStats.bestSetPerSession(nextExercise.id),
                ExerciseStats.dominantMetric(nextExercise.id),
            ])
            if (isStale()) return
            setExercise(nextExercise)
            setHistory(entries)
            setDominantMetric(dominant)
        } catch (error) {
            if (isStale()) return
            log('error', 'Failed to load exercise detail', error)
            setLoadError(t('failedToLoadExerciseDetails'))
        } finally {
            if (!isStale()) setIsLoading(false)
        }
    }, [beginLoad, exerciseRepo, id, t])

    useFocusEffect(
        useCallback(() => {
            loadData()
        }, [loadData])
    )

    // Reflect data a background sync just pulled (e.g. right after login).
    useReloadOnSyncSuccess(loadData)

    useFocusEffect(
        useCallback(() => {
            navigation.getParent()?.setOptions({
                headerTitle: exercise?.name ?? '',
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
                        <Button
                            label={t('edit')}
                            variant={'text'}
                            onPress={() => router.push(`/(tabs)/exercises/edit/${exercise.id}`)}
                            style={styles.headerButton}
                        />
                    ) : null,
            })
        }, [exercise, navigation, theme, t])
    )

    const type = exercise?.type ?? 'weight'
    const dominant: PrimaryMetric = dominantMetric ?? ExerciseTypeMetadata.defaultDominantMetric(type)
    const record = useMemo(() => personalRecord(type, history), [history, type])
    const points = useMemo(
        () => chartPoints(filterByRange(history, range, new Date()), metric, dominant),
        [dominant, history, metric, range]
    )

    if (isLoading && !exercise) {
        return (
            <ScreenLayout style={styles.centered}>
                <ActivityIndicator size={'large'} color={theme.primary} />
            </ScreenLayout>
        )
    }

    if (!exercise) {
        return (
            <ScreenLayout style={styles.centered}>
                <EmptyState message={loadError ?? t('failedToLoadExerciseDetails')} icon={'exclamation-circle'} />
                <Button label={t('retry')} onPress={loadData} />
            </ScreenLayout>
        )
    }

    const { secondary } = resolveExerciseMuscles(exercise)
    const equipment = asEquipment(exercise.equipment)
    const formatDate = (date: string) =>
        formatLocalizedDate(
            parseLocalDate(date),
            i18n.language,
            { weekday: 'short', day: 'numeric', month: 'short' },
            true
        )
    const rangeSegments: Segment<HistoryRange>[] = [
        { value: '1m', label: t('range1m') },
        { value: '3m', label: t('range3m') },
        { value: '1y', label: t('range1y') },
        { value: 'all', label: t('rangeAll') },
    ]
    const metricSegments: Segment<ChartMetric>[] = [
        { value: 'best', label: t('metricBestSet') },
        { value: 'oneRepMax', label: t('metricOneRepMax') },
    ]
    const newestFirst = [...history].reverse()
    const shownHistory = showAllHistory ? newestFirst : newestFirst.slice(0, HISTORY_PREVIEW)

    return (
        <ScrollScreenLayout contentContainerStyle={styles.content}>
            <View style={styles.stack}>
                <View style={styles.summary}>
                    <TouchableOpacity
                        onPress={() => setShowPhoto(true)}
                        disabled={!exercise.photo_uri}
                        accessibilityRole={exercise.photo_uri ? 'imagebutton' : undefined}
                        accessibilityLabel={exercise.photo_uri ? t('viewPhoto') : undefined}
                    >
                        <InitialsAvatar name={exercise.name} photoUri={exercise.photo_uri} size={56} />
                    </TouchableOpacity>
                    <View style={styles.summaryText}>
                        <Typography.Body weight={'semibold'}>
                            {[exerciseMuscleLabel(t, exercise), equipment ? equipmentLabel(t, equipment) : null]
                                .filter(Boolean)
                                .join(' · ')}
                        </Typography.Body>
                        {secondary.length > 0 && (
                            <Typography.Label color={'textSecondary'}>
                                {t('alsoWorks', { list: secondary.map((key) => muscleLabel(t, key)).join(', ') })}
                            </Typography.Label>
                        )}
                    </View>
                </View>

                {record ? (
                    <>
                        <ListSection title={t('personalBest')}>
                            <View style={styles.record}>
                                <View style={styles.recordMain}>
                                    <Typography.Title numeric>
                                        {formatSetWithUnits(type, record.entry.set, (count) =>
                                            t('repsCount', { count })
                                        )}
                                    </Typography.Title>
                                    <Typography.Label color={'textSecondary'}>
                                        {formatDate(record.entry.date)}
                                    </Typography.Label>
                                </View>
                                {record.estimatedOneRepMax !== null && (
                                    <View style={styles.recordSide}>
                                        <Typography.Subtitle numeric>
                                            {formatHeadlineStat(
                                                type,
                                                'weight',
                                                Math.round(record.estimatedOneRepMax * 10) / 10
                                            )}
                                        </Typography.Subtitle>
                                        <Typography.Label color={'textSecondary'}>
                                            {t('metricOneRepMax')}
                                        </Typography.Label>
                                    </View>
                                )}
                            </View>
                        </ListSection>

                        <ListSection title={t('progress')}>
                            <View style={styles.chartBlock}>
                                {type === 'weight' && (
                                    <SegmentedControl segments={metricSegments} value={metric} onChange={setMetric} />
                                )}
                                {points.length > 0 ? (
                                    <ProgressChart
                                        points={points}
                                        language={i18n.language}
                                        formatValue={(value) =>
                                            ExerciseTypeMetadata.formatAxisLabel(
                                                metric === 'oneRepMax' ? 'weight' : dominant,
                                                value
                                            )
                                        }
                                        inverted={
                                            metric === 'best' && ExerciseTypeMetadata.isBetterLower(type, dominant)
                                        }
                                    />
                                ) : (
                                    <Typography.Body color={'textSecondary'} style={styles.chartEmpty}>
                                        {t('noWorkoutsInRange')}
                                    </Typography.Body>
                                )}
                                <SegmentedControl segments={rangeSegments} value={range} onChange={setRange} />
                            </View>
                        </ListSection>

                        <ListSection title={t('workoutsCount', { count: history.length })}>
                            {shownHistory.map((entry) => (
                                <ListRow
                                    key={`${entry.date}-${entry.set.id}`}
                                    label={formatDate(entry.date)}
                                    value={formatCompactSetLabel(type, dominant, entry.set)}
                                    accessory={'chevron'}
                                    onPress={() => router.push(`/(tabs)/history/${entry.set.workout_id}`)}
                                />
                            ))}
                            {history.length > HISTORY_PREVIEW && !showAllHistory && (
                                <ListRow label={t('showAll')} onPress={() => setShowAllHistory(true)} />
                            )}
                        </ListSection>
                    </>
                ) : (
                    <Typography.Body color={'textSecondary'} style={styles.emptyLine}>
                        {t('noSetsLoggedYet')}
                    </Typography.Body>
                )}
            </View>

            <FullScreenImageModal
                visible={showPhoto}
                onClose={() => setShowPhoto(false)}
                imageUri={exercise.photo_uri || null}
            />
        </ScrollScreenLayout>
    )
}

const styles = StyleSheet.create({
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.md,
    },
    content: {
        paddingBottom: Spacing.xl,
    },
    stack: {
        gap: Spacing.lg,
    },
    // Flush with the cards below.
    summary: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    summaryText: {
        flex: 1,
        gap: Spacing.xs2,
    },
    record: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: Spacing.md,
        gap: Spacing.md,
    },
    recordMain: {
        flex: 1,
        gap: Spacing.xs2,
    },
    recordSide: {
        alignItems: 'flex-end',
        gap: Spacing.xs2,
    },
    chartBlock: {
        padding: Spacing.md,
        gap: Spacing.md,
    },
    chartEmpty: {
        textAlign: 'center',
        paddingVertical: Spacing.xl,
    },
    emptyLine: {
        textAlign: 'center',
        paddingVertical: Spacing.lg,
    },
    headerBack: {
        paddingLeft: Spacing.md,
        paddingRight: Spacing.sm,
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
    },
    headerButton: {
        minHeight: 44,
        paddingHorizontal: Spacing.md,
    },
})
