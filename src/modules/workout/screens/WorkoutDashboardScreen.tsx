import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { useExerciseRepo, useWorkoutRepo, useWorkoutTemplateRepo } from '@/src/data/RepositoryContext'
import { useReloadOnSyncSuccess } from '@/src/data/sync/useReloadOnSyncSuccess'
import type { Workout } from '@/src/db/workouts'
import type { WorkoutTemplate } from '@/src/db/workoutTemplates'
import type { MuscleGroup } from '@/src/domain/exerciseTaxonomy'
import { Button } from '@/src/modules/core/components/Button'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { InitialsAvatar } from '@/src/modules/core/components/InitialsAvatar'
import { ListRow } from '@/src/modules/core/components/ListRow'
import { ListSection } from '@/src/modules/core/components/ListSection'
import { Appear } from '@/src/modules/core/components/motion'
import { ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useMinimumSkeleton } from '@/src/modules/core/hooks/useMinimumSkeleton'
import { useRevealOnce } from '@/src/modules/core/hooks/useRevealOnce'
import { useStaleGuard } from '@/src/modules/core/hooks/useStaleGuard'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { nextHasLoadedOnce, shouldShowSkeleton } from '@/src/modules/core/utils/loadingGate'
import { log } from '@/src/modules/core/utils/logger'
import { showToast } from '@/src/modules/core/utils/toast'
import { muscleGroupLabel } from '@/src/modules/exercises/taxonomyLabels'
import { summarizeTemplates, type TemplateSummary, templateSubtitle } from '@/src/modules/templates/templateSummary'
import { formatLocalDateYYYYMMDD, formatLocalizedDate } from '@/src/utils/dateTime'
import { formatWorkoutLength } from '@/src/utils/formatters'
import { notifyActiveWorkoutChanged } from '../activeWorkoutSignal'
import { ElapsedTime } from '../components/ElapsedTime'
import { PlateMotif } from '../components/PlateMotif'
import { WeekChart } from '../components/WeekChart'
import { muscleGroupsTrained } from '../muscleBalance'
import { summarizeWeek, type WeekSummary, workoutMinutes } from '../weekSummary'
import { WorkoutDashboardSkeleton } from './components/WorkoutDashboardSkeleton'

// How many plans the start module lists before "All plans".
const TEMPLATES_SHOWN = 3

type LastWorkoutSummary = {
    workout: Workout
    setCount: number
    muscleGroups: MuscleGroup[]
}

type ActiveSummary = {
    workout: Workout
    setCount: number
    templateName: string | null
}

// The Workout tab: start or resume first, then this week at a glance, then the
// last workout as one row. Everything analytical lives one level down.
export default function WorkoutDashboardScreen() {
    const workoutRepo = useWorkoutRepo()
    const exerciseRepo = useExerciseRepo()
    const templateRepo = useWorkoutTemplateRepo()
    const { t, i18n } = useTranslation()
    const { theme, isDark } = useTheme()
    const navigation = useNavigation()

    useFocusEffect(
        useCallback(() => {
            navigation.getParent()?.setOptions({
                headerTitle: t('workout'),
                headerLeft: () => null,
                headerRight: () => null,
            })
        }, [navigation, t])
    )

    const [active, setActive] = useState<ActiveSummary | null>(null)
    const [hasAnyWorkout, setHasAnyWorkout] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    // One-way latch: true after the first load settles, so a focus reload shows
    // the existing screen instead of flashing the skeleton back in.
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
    const [isStartingWorkout, setIsStartingWorkout] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [week, setWeek] = useState<WeekSummary | null>(null)
    const [lastWorkout, setLastWorkout] = useState<LastWorkoutSummary | null>(null)
    const [templates, setTemplates] = useState<TemplateSummary[]>([])
    const startInFlightRef = useRef(false)

    const beginLoad = useStaleGuard()
    const hasRevealed = useRevealOnce(hasLoadedOnce)
    const hasShownContent = useRef(false)
    useEffect(() => {
        if (hasLoadedOnce) hasShownContent.current = true
    }, [hasLoadedOnce])

    const loadData = useCallback(async () => {
        // Focus, pull-to-refresh and the post-sync reload can run at once; only
        // the most recent run commits, so a stale read never clobbers fresh data.
        const isStale = beginLoad()
        setLoadError(null)
        setIsLoading(true)
        try {
            const activeWorkout = await workoutRepo.getActiveWorkout()
            const all = await workoutRepo.getAllWorkouts()
            const finished = all.filter((w) => w.status === 'finished' && w.id !== activeWorkout?.id)
            const today = new Date()
            const nextWeek = summarizeWeek(finished, activeWorkout, today)

            const lastFinished = finished[0] ?? null

            const [allExercises, allTemplates, lastSets, activeSets] = await Promise.all([
                exerciseRepo.getAll(),
                templateRepo.getAll(),
                lastFinished ? workoutRepo.getSets(lastFinished.id) : Promise.resolve([]),
                activeWorkout ? workoutRepo.getSets(activeWorkout.id) : Promise.resolve([]),
            ])

            if (isStale()) return

            setActive(
                activeWorkout
                    ? {
                          workout: activeWorkout,
                          setCount: activeSets.length,
                          templateName:
                              allTemplates.find((tpl) => tpl.uuid === activeWorkout.template_uuid)?.name ?? null,
                      }
                    : null
            )
            setHasAnyWorkout(all.length > 0)
            setWeek(nextWeek)
            setLastWorkout(
                lastFinished
                    ? { workout: lastFinished, setCount: lastSets.length, muscleGroups: muscleGroupsTrained(lastSets) }
                    : null
            )
            setTemplates(summarizeTemplates(allTemplates, allExercises))
        } catch (error) {
            if (isStale()) return
            log('error', 'Failed to load workout dashboard', error)
            setLoadError(t('failedToLoadWorkouts'))
        } finally {
            if (!isStale()) {
                setIsLoading(false)
                setHasLoadedOnce((current) => nextHasLoadedOnce(current, true))
            }
        }
    }, [beginLoad, t, workoutRepo, exerciseRepo, templateRepo])

    useFocusEffect(
        useCallback(() => {
            loadData()
        }, [loadData])
    )

    // Reflect rows a background sync just pulled (e.g. right after login).
    const isHydrating = useReloadOnSyncSuccess(loadData)
    const showSkeleton = useMinimumSkeleton(shouldShowSkeleton({ isHydrating, isLoading, hasLoadedOnce }))

    const onRefresh = async () => {
        setRefreshing(true)
        await loadData()
        setRefreshing(false)
    }

    // template null = Unplanned Workout (a free workout).
    const startWorkout = async (template: WorkoutTemplate | null) => {
        // A ref, not the state flag: two taps in the same frame both still see
        // isStartingWorkout === false and would each create a Workout.
        if (startInFlightRef.current) return
        startInFlightRef.current = true
        setIsStartingWorkout(true)
        try {
            // Re-check: a Workout may have been started elsewhere (another
            // device, via sync) since the screen loaded.
            const running = await workoutRepo.getActiveWorkout()
            const id = running?.id ?? (await workoutRepo.create(formatLocalDateYYYYMMDD(), template?.uuid ?? null))
            notifyActiveWorkoutChanged()
            router.push(`/(tabs)/workout/${id}`)
            if (running) {
                showToast.info({ title: t('workoutAlreadyRunningTitle'), message: t('workoutAlreadyRunning') })
            }
        } catch (error) {
            log('error', 'Failed to start workout', error)
            showToast.danger({ title: t('error'), message: t('failedToStartWorkout') })
        } finally {
            startInFlightRef.current = false
            setIsStartingWorkout(false)
        }
    }

    const formatDuration = (minutes: number): string => formatWorkoutLength(minutes, t('min'))

    if (showSkeleton) {
        return (
            <ScrollScreenLayout>
                <WorkoutDashboardSkeleton />
            </ScrollScreenLayout>
        )
    }

    if (loadError && !hasAnyWorkout && templates.length === 0) {
        return (
            <ScrollScreenLayout contentContainerStyle={styles.fillContent} style={styles.fill}>
                <View style={styles.centered}>
                    <EmptyState message={loadError} icon={'exclamation-circle'} />
                    <Button label={t('retry')} onPress={loadData} />
                </View>
            </ScrollScreenLayout>
        )
    }

    const reveal = hasRevealed.current
    // The running workout and Start fade into each other when one replaces the
    // other, but not on first load, where the whole screen already reveals.
    const swaps = hasShownContent.current
    const shownTemplates = templates.slice(0, TEMPLATES_SHOWN)
    const today = formatLocalizedDate(
        new Date(),
        i18n.language,
        { weekday: 'long', day: 'numeric', month: 'long' },
        true
    )

    return (
        <ScrollScreenLayout
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            contentContainerStyle={styles.content}
        >
            <Appear variant={'down'} animateOnEnter={reveal} style={styles.stack}>
                <View style={[styles.hero, { backgroundColor: theme.surface }]}>
                    <PlateMotif
                        color={theme.primary}
                        surface={theme.surface}
                        intensity={isDark ? 1.4 : 1}
                        style={styles.motif}
                    />
                    <Typography.Label color={'textSecondary'}>{today}</Typography.Label>

                    {active ? (
                        <Appear
                            key={'active'}
                            animateOnEnter={swaps}
                            style={[styles.activePanel, { backgroundColor: theme.primaryTint }]}
                        >
                            <View style={styles.activeText}>
                                <Typography.Label color={'primary'} weight={'semibold'}>
                                    {t('workoutInProgress')}
                                </Typography.Label>
                                <ElapsedTime startTime={active.workout.start_time} color={'text'} size={'display'} />
                                <Typography.Body color={'textSecondary'} numberOfLines={1}>
                                    {[
                                        active.templateName ?? t('unplannedWorkout'),
                                        t('setsCount', { count: active.setCount }),
                                    ].join(' · ')}
                                </Typography.Body>
                            </View>
                            <Button
                                label={t('resumeWorkout')}
                                onPress={() => router.push(`/(tabs)/workout/${active.workout.id}`)}
                            />
                        </Appear>
                    ) : null}

                    {week && (
                        <View style={styles.weekBlock}>
                            <View style={styles.headline}>
                                <Typography.Title size={'display'} numeric>
                                    {week.workoutDays}
                                </Typography.Title>
                                <Typography.Body color={'textSecondary'}>
                                    {t('heroWorkoutsThisWeek', { count: week.workoutDays })}
                                </Typography.Body>
                            </View>
                            <TouchableOpacity
                                onPress={() => router.push('/(tabs)/history')}
                                activeOpacity={0.7}
                                accessibilityRole={'button'}
                                accessibilityLabel={`${t('thisWeek')}: ${weekCaption(t, week)}`}
                                accessibilityHint={t('viewHistory')}
                            >
                                <WeekChart days={week.days} />
                            </TouchableOpacity>
                            {/* Left out until there is something to say ("0 min trained" is noise). */}
                            {(week.totalMinutes > 0 || week.streakWeeks > 0) && (
                                <Typography.Label color={'textSecondary'} numeric>
                                    {[
                                        ...(week.totalMinutes > 0
                                            ? [t('trainedTime', { time: formatDuration(week.totalMinutes) })]
                                            : []),
                                        ...(week.streakWeeks > 0 ? [t('weekStreak', { count: week.streakWeeks })] : []),
                                    ].join(' · ')}
                                </Typography.Label>
                            )}
                        </View>
                    )}

                    {!active && (
                        <Appear key={'start'} animateOnEnter={swaps}>
                            <Button
                                label={t('startWorkout')}
                                onPress={() => startWorkout(null)}
                                isLoading={isStartingWorkout}
                                accessibilityHint={t('unplannedWorkoutHint')}
                            />
                        </Appear>
                    )}
                </View>

                {!active && (
                    <Appear animateOnEnter={swaps}>
                        <ListSection title={t('startFromPlan')}>
                            {shownTemplates.map((summary) => (
                                <ListRow
                                    key={summary.template.id}
                                    label={summary.template.name}
                                    subtitle={templateSubtitle(t, summary)}
                                    leading={<InitialsAvatar name={summary.template.name} />}
                                    trailing={<FontAwesome name={'play'} size={12} color={theme.textSecondary} />}
                                    onPress={() => startWorkout(summary.template)}
                                    disabled={isStartingWorkout}
                                    accessibilityHint={t('startPlannedHint')}
                                />
                            ))}
                            <ListRow
                                label={templates.length > 0 ? t('allPlans') : t('newTemplate')}
                                leading={
                                    <View style={styles.leadingSlot}>
                                        <FontAwesome
                                            name={templates.length > 0 ? 'th-list' : 'plus'}
                                            size={16}
                                            color={theme.textSecondary}
                                        />
                                    </View>
                                }
                                value={templates.length > 0 ? String(templates.length) : undefined}
                                accessory={'chevron'}
                                onPress={() =>
                                    router.push(
                                        templates.length > 0
                                            ? '/(tabs)/workout/templates'
                                            : '/(tabs)/workout/templates/new'
                                    )
                                }
                            />
                        </ListSection>
                    </Appear>
                )}

                {lastWorkout && (
                    <ListSection title={t('lastWorkout')}>
                        <ListRow
                            label={formatLocalizedDate(
                                lastWorkout.workout.date,
                                i18n.language,
                                { weekday: 'long', month: 'long', day: 'numeric' },
                                true
                            )}
                            subtitle={[
                                formatDuration(workoutMinutes(lastWorkout.workout)),
                                t('setsCount', { count: lastWorkout.setCount }),
                                ...lastWorkout.muscleGroups.slice(0, 3).map((group) => muscleGroupLabel(t, group)),
                            ].join(' · ')}
                            accessory={'chevron'}
                            onPress={() => router.push(`/(tabs)/workout/${lastWorkout.workout.id}`)}
                        />
                    </ListSection>
                )}
            </Appear>
        </ScrollScreenLayout>
    )
}

// "2 workouts this week · 3-week streak"; the streak is left out until there is one.
const weekCaption = (t: ReturnType<typeof useTranslation>['t'], week: WeekSummary): string =>
    [
        t('workoutsThisWeek', { count: week.workoutDays }),
        ...(week.streakWeeks > 0 ? [t('weekStreak', { count: week.streakWeeks })] : []),
    ].join(' · ')

const styles = StyleSheet.create({
    content: {
        paddingBottom: Spacing.xl,
    },
    stack: {
        gap: Spacing.lg,
    },
    fill: {
        flex: 1,
    },
    fillContent: {
        flexGrow: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        gap: Spacing.md,
    },
    // Inset like the list rows below, so text in and under the hero shares one edge.
    hero: {
        borderRadius: Radius.lg,
        padding: Spacing.md,
        gap: Spacing.md + Spacing.xs,
        overflow: 'hidden',
    },
    // Cropped by the hero's rounded corner, so only an arc of the plates shows.
    motif: {
        position: 'absolute',
        top: -70,
        right: -62,
    },
    activePanel: {
        borderRadius: Radius.md,
        padding: Spacing.md,
        gap: Spacing.md,
    },
    activeText: {
        gap: Spacing.xs,
    },
    weekBlock: {
        gap: Spacing.md,
    },
    headline: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: Spacing.sm,
    },
    // Same width as an InitialsAvatar, so row text lines up under the plans.
    leadingSlot: {
        width: 40,
        alignItems: 'center',
    },
})
