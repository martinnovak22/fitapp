import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontSize, FontWeight } from '@/src/constants/Typography'
import { useExerciseRepo, useWorkoutRepo } from '@/src/data/RepositoryContext'
import { useReloadOnSyncSuccess } from '@/src/data/sync/useReloadOnSyncSuccess'
import type { Workout } from '@/src/db/workouts'
import { Button } from '@/src/modules/core/components/Button'
import { Card } from '@/src/modules/core/components/Card'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { Appear, ListItemAppear } from '@/src/modules/core/components/motion'
import { ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useStaleGuard } from '@/src/modules/core/hooks/useStaleGuard'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { log } from '@/src/modules/core/utils/logger'
import { showToast } from '@/src/modules/core/utils/toast'
import { formatHourMinute, formatLocalDateYYYYMMDD, formatLocalizedDate } from '@/src/utils/dateTime'
import { WorkoutDashboardSkeleton } from './components/WorkoutDashboardSkeleton'

const DAY_MS = 24 * 60 * 60 * 1000

/** Parse a YYYY-MM-DD string as a local-time date (new Date(str) would parse it as UTC). */
const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
}

/** Monday 00:00 of the week containing the given date. */
const getWeekStart = (value: Date): Date => {
    const d = new Date(value)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d
}

const workoutMinutes = (workout: Workout): number => {
    if (!workout.end_time) return 0
    return Math.max(
        0,
        Math.round((new Date(workout.end_time).getTime() - new Date(workout.start_time).getTime()) / 60000)
    )
}

const capitalizeFirst = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1)

interface WeekDay {
    date: string
    day: string
    workedOut: boolean
    isToday: boolean
}

interface WeekStats {
    streak: number
    trainedMin: number
    daysSinceLast: number | null
}

interface LastWorkoutSummary {
    workout: Workout
    setCount: number
    muscleGroups: (string | null)[]
}

interface MuscleBalanceEntry {
    group: string | null
    count: number
}

export default function WorkoutDashboardScreen() {
    const workoutRepo = useWorkoutRepo()
    const exerciseRepo = useExerciseRepo()
    const { t, i18n } = useTranslation()
    const { theme } = useTheme()
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

    const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null)
    const [allWorkouts, setAllWorkouts] = useState<Workout[]>([])
    const [refreshing, setRefreshing] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isStartingWorkout, setIsStartingWorkout] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [weekDays, setWeekDays] = useState<WeekDay[]>([])
    const [weekStats, setWeekStats] = useState<WeekStats>({ streak: 0, trainedMin: 0, daysSinceLast: null })
    const [lastWorkoutSummary, setLastWorkoutSummary] = useState<LastWorkoutSummary | null>(null)
    const [muscleBalance, setMuscleBalance] = useState<MuscleBalanceEntry[]>([])

    const finishedWorkouts = allWorkouts.filter(
        (workout) => workout.status === 'finished' && workout.id !== activeWorkout?.id
    )
    const previousWorkouts = finishedWorkouts.slice(1, 3)

    const beginLoad = useStaleGuard()

    const loadData = useCallback(async () => {
        // Focus, pull-to-refresh, and the post-sync reload can all call loadData
        // at once. While the init sync is writing, workouts become readable
        // before their sets, so an earlier (stale) call can resolve last and
        // clobber the fresh sets-derived state — the last-workout recap and
        // muscle balance — with empty data while the week strip looks correct.
        // Compute into locals and let only the most recent run commit.
        const isStale = beginLoad()

        setLoadError(null)
        setIsLoading(true)
        try {
            const active = await workoutRepo.getActiveWorkout()
            const all = await workoutRepo.getAllWorkouts()
            const finished = all.filter((w) => w.status === 'finished' && w.id !== active?.id)

            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const todayStr = formatLocalDateYYYYMMDD(today)
            const weekStart = getWeekStart(today)
            const weekStartStr = formatLocalDateYYYYMMDD(weekStart)
            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekStart.getDate() + 6)
            const weekEndStr = formatLocalDateYYYYMMDD(weekEnd)

            const weekWorkouts = finished.filter((w) => w.date >= weekStartStr && w.date <= weekEndStr)
            const weekDates = new Set(weekWorkouts.map((w) => w.date))
            if (active && active.date >= weekStartStr && active.date <= weekEndStr) {
                weekDates.add(active.date)
            }

            const nextWeekDays: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(weekStart)
                d.setDate(weekStart.getDate() + i)
                const dateStr = formatLocalDateYYYYMMDD(d)
                return {
                    date: dateStr,
                    day: formatLocalizedDate(d, i18n.language, { weekday: 'narrow' }),
                    workedOut: weekDates.has(dateStr),
                    isToday: dateStr === todayStr,
                }
            })

            const trainedWeekStarts = new Set(
                finished.map((w) => formatLocalDateYYYYMMDD(getWeekStart(parseLocalDate(w.date))))
            )
            let streak = 0
            const cursor = new Date(weekStart)
            // An untrained current week doesn't break the streak — it just isn't counted yet.
            if (!trainedWeekStarts.has(formatLocalDateYYYYMMDD(cursor))) {
                cursor.setDate(cursor.getDate() - 7)
            }
            while (trainedWeekStarts.has(formatLocalDateYYYYMMDD(cursor))) {
                streak++
                cursor.setDate(cursor.getDate() - 7)
            }

            const trainedMin = weekWorkouts.reduce((sum, w) => sum + workoutMinutes(w), 0)

            const lastFinished = finished[0] ?? null
            const daysSinceLast = lastFinished
                ? Math.round((today.getTime() - parseLocalDate(lastFinished.date).getTime()) / DAY_MS)
                : null

            let nextLastWorkoutSummary: LastWorkoutSummary | null = null
            if (lastFinished) {
                const sets = await workoutRepo.getSets(lastFinished.id)
                const muscleGroups = [...new Set(sets.map((s) => s.muscle_group))].filter(
                    (g): g is string => g !== null
                )
                nextLastWorkoutSummary = { workout: lastFinished, setCount: sets.length, muscleGroups }
            }

            const weekSets = (await Promise.all(weekWorkouts.map((w) => workoutRepo.getSets(w.id)))).flat()
            // Seed every known muscle group at 0 so untrained groups stay visible in the balance.
            const allExercises = await exerciseRepo.getAll()
            const groupCounts = new Map<string | null, number>()
            for (const exercise of allExercises) {
                if (exercise.muscle_group) groupCounts.set(exercise.muscle_group, 0)
            }
            for (const set of weekSets) {
                groupCounts.set(set.muscle_group, (groupCounts.get(set.muscle_group) ?? 0) + 1)
            }
            const nextMuscleBalance: MuscleBalanceEntry[] = [...groupCounts.entries()]
                .map(([group, count]) => ({ group, count }))
                .sort((a, b) => b.count - a.count || (a.group ?? '').localeCompare(b.group ?? ''))

            // A newer run superseded this one while we were reading; drop these
            // now-stale results rather than overwrite the fresh ones.
            if (isStale()) return

            setActiveWorkout(active)
            setAllWorkouts(all)
            setWeekDays(nextWeekDays)
            setWeekStats({ streak, trainedMin, daysSinceLast })
            setLastWorkoutSummary(nextLastWorkoutSummary)
            setMuscleBalance(nextMuscleBalance)
        } catch (error) {
            if (isStale()) return
            log('error', 'Failed to load workout dashboard', error)
            setLoadError(t('failedToLoadWorkouts'))
        } finally {
            if (!isStale()) setIsLoading(false)
        }
    }, [beginLoad, i18n.language, t, workoutRepo, exerciseRepo])

    useFocusEffect(
        useCallback(() => {
            loadData()
        }, [loadData])
    )

    // Reflect rows a background sync just pulled (e.g. right after login)
    // without making the user pull to refresh.
    const isHydrating = useReloadOnSyncSuccess(loadData)

    const onRefresh = async () => {
        setRefreshing(true)
        await loadData()
        setRefreshing(false)
    }

    const handleStartWorkout = async () => {
        if (isStartingWorkout) return
        setIsStartingWorkout(true)
        if (activeWorkout) {
            router.push(`/(tabs)/workout/${activeWorkout.id}`)
            setIsStartingWorkout(false)
            return
        }
        try {
            const today = formatLocalDateYYYYMMDD()
            const id = await workoutRepo.create(today)
            router.push(`/(tabs)/workout/${id}`)
        } catch (error) {
            log('error', 'Failed to start workout', error)
            showToast.danger({ title: t('error'), message: t('failedToStartWorkout') })
        } finally {
            setIsStartingWorkout(false)
        }
    }

    const formatTrainedTime = (minutes: number): string => {
        const h = Math.floor(minutes / 60)
        const m = minutes % 60
        return h > 0 ? `${h} h ${m} ${t('min')}` : `${m} ${t('min')}`
    }

    const muscleGroupLabel = (group: string | null): string => (group ? capitalizeFirst(group) : t('otherMuscleGroup'))

    // While the post-login hydration pull is running, even a non-empty read is
    // partial (workouts land before their sets, so e.g. the muscle balance
    // would render empty) — hold the skeleton until the cycle settles.
    if (isHydrating || (isLoading && allWorkouts.length === 0)) {
        return (
            <ScrollScreenLayout>
                <WorkoutDashboardSkeleton />
            </ScrollScreenLayout>
        )
    }

    if (loadError && allWorkouts.length === 0) {
        return (
            <ScrollScreenLayout contentContainerStyle={layoutStyles.fillContent} style={layoutStyles.fill}>
                <View style={layoutStyles.loadingContainer}>
                    <EmptyState message={loadError} icon={'exclamation-circle'} />
                    <Button label={t('retry')} onPress={loadData} style={{ marginTop: Spacing.md }} />
                </View>
            </ScrollScreenLayout>
        )
    }

    const maxBalanceCount = muscleBalance[0]?.count ?? 0

    return (
        <ScrollScreenLayout
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        >
            <ListItemAppear index={0}>
                <Card
                    onPress={() => router.push('/workout/calendar')}
                    style={layoutStyles.heroCard}
                    accessibilityLabel={t('calendar')}
                    accessibilityHint={t('fullHistory')}
                >
                    <View style={layoutStyles.headerRow}>
                        <Typography.Subtitle size="md" weight="bold">
                            {t('thisWeek')}
                        </Typography.Subtitle>
                        <FontAwesome name="chevron-right" size={12} color={theme.textSecondary} />
                    </View>

                    <View style={layoutStyles.weekRow}>
                        {weekDays.map((day) => (
                            <View key={day.date} style={layoutStyles.dayCol}>
                                <View
                                    style={[
                                        layoutStyles.dayBox,
                                        { backgroundColor: theme.surfaceMuted, borderColor: `${theme.border}20` },
                                        day.isToday && { borderColor: theme.primary, borderStyle: 'dashed' },
                                        day.workedOut && {
                                            backgroundColor: theme.primary,
                                            borderColor: theme.primary,
                                            borderStyle: 'solid',
                                        },
                                    ]}
                                >
                                    {day.workedOut && <FontAwesome name="check" size={10} color={theme.onPrimary} />}
                                </View>
                                <Typography.Meta
                                    style={[
                                        { fontSize: FontSize.xs, color: theme.textSecondary },
                                        (day.workedOut || day.isToday) && {
                                            color: theme.text,
                                            fontWeight: FontWeight.bold,
                                        },
                                    ]}
                                >
                                    {day.day}
                                </Typography.Meta>
                            </View>
                        ))}
                    </View>

                    <View style={[layoutStyles.heroDivider, { backgroundColor: theme.hairline }]} />

                    <View style={layoutStyles.heroStatsRow}>
                        <View style={layoutStyles.heroStatItem}>
                            <Typography.Subtitle style={layoutStyles.statValue}>
                                {t('weeksShort', { count: weekStats.streak })}
                            </Typography.Subtitle>
                            <Typography.Meta style={layoutStyles.statLabel}>{t('weekStreakLabel')}</Typography.Meta>
                        </View>
                        <View style={[layoutStyles.heroStatSeparator, { backgroundColor: theme.hairline }]} />
                        <View style={layoutStyles.heroStatItem}>
                            <Typography.Subtitle style={layoutStyles.statValue}>
                                {formatTrainedTime(weekStats.trainedMin)}
                            </Typography.Subtitle>
                            <Typography.Meta style={layoutStyles.statLabel}>{t('trainedLabel')}</Typography.Meta>
                        </View>
                        <View style={[layoutStyles.heroStatSeparator, { backgroundColor: theme.hairline }]} />
                        <View style={layoutStyles.heroStatItem}>
                            <Typography.Subtitle style={layoutStyles.statValue}>
                                {weekStats.daysSinceLast === null
                                    ? '—'
                                    : weekStats.daysSinceLast === 0
                                      ? t('today')
                                      : t('daysShort', { count: weekStats.daysSinceLast })}
                            </Typography.Subtitle>
                            <Typography.Meta style={layoutStyles.statLabel}>{t('sinceLastLabel')}</Typography.Meta>
                        </View>
                    </View>
                </Card>
            </ListItemAppear>

            <ListItemAppear index={1}>
                <Card style={[layoutStyles.activeCard, { borderLeftColor: theme.primary }]}>
                    {activeWorkout ? (
                        <Appear key="active">
                            <View style={layoutStyles.activeHeader}>
                                <Typography.Subtitle size="md" weight="bold">
                                    {t('activeSession')}
                                </Typography.Subtitle>
                                <View style={[layoutStyles.liveIndicator, { backgroundColor: `${theme.primary}20` }]}>
                                    <View style={[layoutStyles.liveDot, { backgroundColor: theme.primary }]} />
                                    <Typography.Meta
                                        style={{
                                            fontSize: FontSize.xs,
                                            fontWeight: FontWeight.bold,
                                            color: theme.primary,
                                            letterSpacing: 0.5,
                                        }}
                                    >
                                        {t('live')}
                                    </Typography.Meta>
                                </View>
                            </View>
                            <Typography.Body style={[layoutStyles.activeTime, { color: theme.textSecondary }]}>
                                {t('startedAt')} {formatHourMinute(activeWorkout.start_time)}
                            </Typography.Body>
                            <Button
                                label={t('resumeSession')}
                                onPress={handleStartWorkout}
                                isLoading={isStartingWorkout}
                            />
                        </Appear>
                    ) : (
                        <Appear key="start">
                            <Typography.Body style={[layoutStyles.activePromo, { color: theme.textSecondary }]}>
                                {t('readyToCrush')}
                            </Typography.Body>
                            <Button
                                label={t('startNewWorkout')}
                                onPress={handleStartWorkout}
                                isLoading={isStartingWorkout}
                            />
                        </Appear>
                    )}
                </Card>
            </ListItemAppear>

            <ListItemAppear index={2}>
                <Card>
                    {lastWorkoutSummary ? (
                        <>
                            <Card
                                onPress={() => router.push(`/(tabs)/workout/${lastWorkoutSummary.workout.id}`)}
                                style={layoutStyles.recapPressable}
                                accessibilityLabel={t('lastWorkout')}
                                accessibilityHint={t('viewHistory')}
                            >
                                <View style={layoutStyles.headerRow}>
                                    <Typography.Subtitle size="md" weight="bold">
                                        {t('lastWorkout')}
                                    </Typography.Subtitle>
                                    <FontAwesome name="chevron-right" size={12} color={theme.textSecondary} />
                                </View>

                                <Typography.Body style={[layoutStyles.recapDate, { color: theme.text }]}>
                                    {formatLocalizedDate(
                                        lastWorkoutSummary.workout.date,
                                        i18n.language,
                                        { weekday: 'long', month: 'long', day: 'numeric' },
                                        true
                                    )}
                                </Typography.Body>

                                <View style={layoutStyles.recapMetaRow}>
                                    <View style={layoutStyles.recapMetaItem}>
                                        <FontAwesome name="clock-o" size={12} color={theme.textSecondary} />
                                        <Typography.Meta style={{ fontSize: FontSize.xs, color: theme.textSecondary }}>
                                            {formatTrainedTime(workoutMinutes(lastWorkoutSummary.workout))}
                                        </Typography.Meta>
                                    </View>
                                    <View style={layoutStyles.recapMetaItem}>
                                        <FontAwesome name="list-ul" size={12} color={theme.textSecondary} />
                                        <Typography.Meta style={{ fontSize: FontSize.xs, color: theme.textSecondary }}>
                                            {t('setsCount', { count: lastWorkoutSummary.setCount })}
                                        </Typography.Meta>
                                    </View>
                                </View>

                                {lastWorkoutSummary.muscleGroups.length > 0 && (
                                    <View style={layoutStyles.chipRow}>
                                        {lastWorkoutSummary.muscleGroups.map((group) => (
                                            <View
                                                key={group}
                                                style={[layoutStyles.chip, { backgroundColor: `${theme.primary}20` }]}
                                            >
                                                <Typography.Meta
                                                    style={{
                                                        fontSize: FontSize.xs,
                                                        color: theme.primary,
                                                        fontWeight: FontWeight.medium,
                                                    }}
                                                >
                                                    {muscleGroupLabel(group)}
                                                </Typography.Meta>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </Card>

                            {previousWorkouts.length > 0 && (
                                <View style={[layoutStyles.previousList, { borderTopColor: theme.hairline }]}>
                                    {previousWorkouts.map((workout) => (
                                        <Card
                                            key={workout.id}
                                            onPress={() => router.push(`/(tabs)/workout/${workout.id}`)}
                                            style={layoutStyles.previousRowCard}
                                            accessibilityLabel={formatLocalizedDate(
                                                workout.date,
                                                i18n.language,
                                                { weekday: 'long', month: 'long', day: 'numeric' },
                                                true
                                            )}
                                            accessibilityHint={t('viewHistory')}
                                        >
                                            <View style={layoutStyles.previousRow}>
                                                <Typography.Body style={{ fontSize: FontSize.sm, color: theme.text }}>
                                                    {formatLocalizedDate(
                                                        workout.date,
                                                        i18n.language,
                                                        { weekday: 'long', month: 'long', day: 'numeric' },
                                                        true
                                                    )}
                                                </Typography.Body>
                                                <Typography.Meta
                                                    style={{ fontSize: FontSize.xs, color: theme.textSecondary }}
                                                >
                                                    {workout.end_time
                                                        ? formatTrainedTime(workoutMinutes(workout))
                                                        : t('incomplete')}
                                                </Typography.Meta>
                                            </View>
                                        </Card>
                                    ))}
                                </View>
                            )}
                        </>
                    ) : (
                        <>
                            <Typography.Subtitle size="md" weight="bold" style={{ marginBottom: Spacing.md }}>
                                {t('history')}
                            </Typography.Subtitle>
                            <EmptyState message={t('noWorkoutsRecorded')} icon={'history'} />
                        </>
                    )}
                </Card>
            </ListItemAppear>

            {muscleBalance.length > 0 && (
                <ListItemAppear index={3}>
                    <Card>
                        <Typography.Subtitle size="md" weight="bold" style={{ marginBottom: Spacing.md }}>
                            {t('muscleBalance')}
                        </Typography.Subtitle>
                        <View style={layoutStyles.balanceList}>
                            {muscleBalance.map((entry) => (
                                <View key={entry.group ?? 'other'} style={layoutStyles.balanceRow}>
                                    <Typography.Meta
                                        style={[layoutStyles.balanceLabel, { color: theme.textSecondary }]}
                                        numberOfLines={1}
                                    >
                                        {muscleGroupLabel(entry.group)}
                                    </Typography.Meta>
                                    <View style={[layoutStyles.balanceTrack, { backgroundColor: theme.surfaceMuted }]}>
                                        <View
                                            style={[
                                                layoutStyles.balanceFill,
                                                {
                                                    backgroundColor: theme.primary,
                                                    width: `${maxBalanceCount > 0 ? Math.round((entry.count / maxBalanceCount) * 100) : 0}%`,
                                                },
                                            ]}
                                        />
                                    </View>
                                    <Typography.Meta
                                        style={[layoutStyles.balanceCount, { color: theme.textSecondary }]}
                                    >
                                        {entry.count}
                                    </Typography.Meta>
                                </View>
                            ))}
                        </View>
                    </Card>
                </ListItemAppear>
            )}
        </ScrollScreenLayout>
    )
}

const layoutStyles = StyleSheet.create({
    fillContent: {
        flexGrow: 1,
    },
    fill: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroCard: {
        paddingVertical: Spacing.lg,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    weekRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: Spacing.xs,
        marginBottom: Spacing.lg,
    },
    dayCol: {
        alignItems: 'center',
        flex: 1,
    },
    dayBox: {
        width: 28,
        height: 28,
        borderRadius: Radius.sm,
        marginBottom: Spacing.sm,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    heroDivider: {
        height: 1,
        marginBottom: Spacing.md,
    },
    heroStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    heroStatItem: {
        alignItems: 'center',
        flex: 1,
    },
    heroStatSeparator: {
        width: 1,
        height: 30,
    },
    statValue: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        marginBottom: 2,
    },
    statLabel: {
        fontSize: FontSize.xs,
    },
    activeCard: {
        borderLeftWidth: 4,
    },
    activeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.md,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: Radius.pill,
        marginRight: Spacing.sm,
    },
    activeTime: {
        marginBottom: Spacing.md,
    },
    activePromo: {
        marginBottom: Spacing.md,
        fontSize: FontSize.sm,
    },
    recapPressable: {
        padding: 0,
        borderWidth: 0,
        backgroundColor: 'transparent',
        marginBottom: 0,
    },
    recapDate: {
        fontSize: FontSize.sm,
        marginBottom: Spacing.sm,
    },
    recapMetaRow: {
        flexDirection: 'row',
        columnGap: Spacing.lg,
        marginBottom: Spacing.md,
    },
    recapMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: Spacing.xs,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
    },
    chip: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.pill,
    },
    previousList: {
        borderTopWidth: 1,
        marginTop: Spacing.md,
        paddingTop: Spacing.sm,
    },
    previousRowCard: {
        padding: 0,
        borderWidth: 0,
        backgroundColor: 'transparent',
        marginBottom: 0,
        paddingVertical: Spacing.sm,
    },
    previousRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    balanceList: {
        rowGap: Spacing.sm,
    },
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: Spacing.sm,
    },
    balanceLabel: {
        width: 80,
        fontSize: FontSize.xs,
    },
    balanceTrack: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    balanceFill: {
        height: 6,
        borderRadius: 3,
    },
    balanceCount: {
        width: 24,
        textAlign: 'right',
        fontSize: FontSize.xs,
    },
})
