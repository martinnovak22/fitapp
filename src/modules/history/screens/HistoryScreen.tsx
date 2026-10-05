import { useFocusEffect, useNavigation } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshControl, ScrollView, SectionList, StyleSheet, View } from 'react-native'
import { Calendar, LocaleConfig } from 'react-native-calendars'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { useExerciseRepo, useWorkoutRepo, useWorkoutTemplateRepo } from '@/src/data/RepositoryContext'
import { useReloadOnSyncSuccess } from '@/src/data/sync/useReloadOnSyncSuccess'
import type { Exercise } from '@/src/db/exercises'
import type { SetSummaryRow, Workout } from '@/src/db/workouts'
import { Button } from '@/src/modules/core/components/Button'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { ListRow } from '@/src/modules/core/components/ListRow'
import { ListSection } from '@/src/modules/core/components/ListSection'
import { MiniBarChart } from '@/src/modules/core/components/MiniBarChart'
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { type Segment, SegmentedControl } from '@/src/modules/core/components/SegmentedControl'
import { Typography } from '@/src/modules/core/components/Typography'
import { useMinimumSkeleton } from '@/src/modules/core/hooks/useMinimumSkeleton'
import { useStaleGuard } from '@/src/modules/core/hooks/useStaleGuard'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { shouldShowSkeleton } from '@/src/modules/core/utils/loadingGate'
import { log } from '@/src/modules/core/utils/logger'
import { MuscleBalanceBars } from '@/src/modules/workout/components/MuscleBalanceBars'
import { computeMuscleBalance } from '@/src/modules/workout/muscleBalance'
import { summarizeWeek } from '@/src/modules/workout/weekSummary'
import { formatAxisDate, formatLocalDateYYYYMMDD, formatLocalizedDate, parseLocalDate } from '@/src/utils/dateTime'
import { buildCalendarLocale } from '../calendarLocale'
import { groupByMonth, setsSince, summarizeWorkoutSets, weeklyTotals } from '../historySummary'
import { HistoryListSkeleton } from './components/HistoryListSkeleton'
import { WorkoutHistoryRow } from './components/WorkoutHistoryRow'

type HistoryView = 'list' | 'calendar' | 'stats'

const STATS_WEEKS = 8
const BALANCE_DAYS = 28

type DayMarking = { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string }

// Every Workout, three ways: a month-grouped list, a Monday-first calendar,
// and the stats (streak, weekly volume, muscle balance) that used to crowd the
// Workout tab.
export default function HistoryScreen() {
    const workoutRepo = useWorkoutRepo()
    const templateRepo = useWorkoutTemplateRepo()
    const exerciseRepo = useExerciseRepo()
    const { t, i18n } = useTranslation()
    const { theme } = useTheme()
    const navigation = useNavigation()
    const [view, setView] = useState<HistoryView>('list')
    const [workouts, setWorkouts] = useState<Workout[]>([])
    const [setRows, setSetRows] = useState<SetSummaryRow[]>([])
    const [exercises, setExercises] = useState<Exercise[]>([])
    const [templateNames, setTemplateNames] = useState<Map<string, string>>(() => new Map())
    const [selectedDate, setSelectedDate] = useState(() => formatLocalDateYYYYMMDD())
    const [initialLoading, setInitialLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [refreshing, setRefreshing] = useState(false)

    useFocusEffect(
        useCallback(() => {
            navigation.getParent()?.setOptions({ headerLeft: () => null, headerRight: () => null })
        }, [navigation])
    )

    const beginLoad = useStaleGuard()
    const loadData = useCallback(
        async (showRefresh = false) => {
            // Focus, pull-to-refresh and the post-sync reload can race; only the
            // most recent run commits.
            const isStale = beginLoad()
            if (showRefresh) setRefreshing(true)
            setLoadError(null)
            try {
                const [all, rows, templates, allExercises] = await Promise.all([
                    workoutRepo.getAllWorkouts(),
                    workoutRepo.getAllSetRows(),
                    templateRepo.getAll(),
                    exerciseRepo.getAll(),
                ])
                if (isStale()) return
                setWorkouts(all)
                setSetRows(rows)
                setExercises(allExercises)
                setTemplateNames(new Map(templates.map((template) => [template.uuid, template.name])))
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
        [beginLoad, exerciseRepo, t, templateRepo, workoutRepo]
    )

    useFocusEffect(
        useCallback(() => {
            loadData(false)
        }, [loadData])
    )
    useReloadOnSyncSuccess(useCallback(() => void loadData(false), [loadData]))

    const showSkeleton = useMinimumSkeleton(
        shouldShowSkeleton({ isHydrating: false, isLoading: initialLoading, hasLoadedOnce: false })
    )

    const summaries = useMemo(() => summarizeWorkoutSets(setRows), [setRows])
    const sections = useMemo(() => groupByMonth(workouts), [workouts])
    const finished = useMemo(() => workouts.filter((w) => w.status === 'finished'), [workouts])
    const templateName = (workout: Workout) =>
        workout.template_uuid ? templateNames.get(workout.template_uuid) : undefined

    const viewSegments: Segment<HistoryView>[] = [
        { value: 'list', label: t('historyList') },
        { value: 'calendar', label: t('calendar') },
        { value: 'stats', label: t('historyStats') },
    ]
    const refreshControl = (
        <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={theme.primary} />
    )

    const body = () => {
        if (workouts.length === 0) {
            return (
                <Typography.Body color={'textSecondary'} style={styles.emptyLine}>
                    {t('noWorkoutsYet')}
                </Typography.Body>
            )
        }
        if (view === 'list') {
            return (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id.toString()}
                    stickySectionHeadersEnabled
                    renderSectionHeader={({ section }) => (
                        <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
                            <Typography.Label color={'textSecondary'}>
                                {[
                                    formatLocalizedDate(
                                        section.month,
                                        i18n.language,
                                        { month: 'long', year: 'numeric' },
                                        true
                                    ),
                                    t('workoutsCount', { count: section.data.length }),
                                ].join(' · ')}
                            </Typography.Label>
                        </View>
                    )}
                    renderItem={({ item, index, section }) => (
                        <WorkoutHistoryRow
                            workout={item}
                            summary={summaries.get(item.id)}
                            templateName={templateName(item)}
                            index={index}
                            count={section.data.length}
                        />
                    )}
                    SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
                    contentContainerStyle={styles.listContent}
                    refreshControl={refreshControl}
                    showsVerticalScrollIndicator={false}
                />
            )
        }
        if (view === 'calendar') {
            // The calendar's month and weekday names follow the app's language.
            LocaleConfig.locales[i18n.language] = buildCalendarLocale(i18n.language, t('calendarToday'))
            LocaleConfig.defaultLocale = i18n.language
            const dayWorkouts = workouts.filter((w) => w.date === selectedDate)
            const marked: Record<string, DayMarking> = Object.fromEntries(
                workouts.map((w) => [w.date, { marked: true, dotColor: theme.primary }])
            )
            marked[selectedDate] = { ...marked[selectedDate], selected: true, selectedColor: theme.primaryTintStrong }
            return (
                <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={refreshControl}>
                    <View style={[styles.calendar, { backgroundColor: theme.surface }]}>
                        <Calendar
                            // Weeks start on Monday, as on the Workout tab (cs and en-GB convention).
                            firstDay={1}
                            key={`${theme.background}-${i18n.language}`}
                            current={selectedDate}
                            onDayPress={(day: { dateString: string }) => setSelectedDate(day.dateString)}
                            markedDates={marked}
                            theme={{
                                backgroundColor: 'transparent',
                                calendarBackground: 'transparent',
                                textSectionTitleColor: theme.textSecondary,
                                selectedDayBackgroundColor: theme.primaryTintStrong,
                                selectedDayTextColor: theme.text,
                                todayTextColor: theme.primary,
                                dayTextColor: theme.text,
                                textDisabledColor: theme.textDisabled,
                                dotColor: theme.primary,
                                selectedDotColor: theme.primary,
                                arrowColor: theme.text,
                                monthTextColor: theme.text,
                                textDayFontWeight: '400',
                                textMonthFontWeight: '600',
                                textDayHeaderFontWeight: '500',
                                textDayFontSize: 15,
                                textMonthFontSize: 16,
                                textDayHeaderFontSize: 12,
                            }}
                        />
                    </View>
                    <View style={styles.dayList}>
                        <Typography.Label color={'textSecondary'} style={styles.inset}>
                            {formatLocalizedDate(
                                parseLocalDate(selectedDate),
                                i18n.language,
                                { weekday: 'long', day: 'numeric', month: 'long' },
                                true
                            )}
                        </Typography.Label>
                        {dayWorkouts.length === 0 ? (
                            <Typography.Body color={'textSecondary'} style={styles.inset}>
                                {t('noWorkoutThisDay')}
                            </Typography.Body>
                        ) : (
                            <View>
                                {dayWorkouts.map((workout, index) => (
                                    <WorkoutHistoryRow
                                        key={workout.id}
                                        workout={workout}
                                        summary={summaries.get(workout.id)}
                                        templateName={templateName(workout)}
                                        showDate={false}
                                        index={index}
                                        count={dayWorkouts.length}
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                </ScrollView>
            )
        }
        const today = new Date()
        const week = summarizeWeek(finished, null, today)
        const weeks = weeklyTotals(finished, summaries, today, STATS_WEEKS)
        const balanceFrom = new Date(today)
        balanceFrom.setDate(today.getDate() - BALANCE_DAYS)
        const balance = computeMuscleBalance(
            exercises,
            setsSince(setRows, finished, formatLocalDateYYYYMMDD(balanceFrom))
        )
        const volumeTotal = weeks.reduce((sum, w) => sum + w.volumeKg, 0)
        return (
            <ScrollView contentContainerStyle={[styles.scrollContent, styles.stats]} refreshControl={refreshControl}>
                <ListSection>
                    <ListRow label={t('weekStreakLabel')} value={t('weeksCount', { count: week.streakWeeks })} />
                    <ListRow label={t('workoutsTotal')} value={String(finished.length)} />
                </ListSection>
                <ListSection
                    title={t('weeklyVolume', { count: STATS_WEEKS })}
                    footer={t('volumeFooter', {
                        total: `${Math.round(volumeTotal).toLocaleString(i18n.language)} ${t('kg')}`,
                    })}
                >
                    <View style={styles.chart}>
                        <MiniBarChart
                            height={72}
                            bars={weeks.map((w, index) => ({
                                key: w.weekStart.toISOString(),
                                label: formatAxisDate(w.weekStart, i18n.language),
                                value: w.volumeKg,
                                current: index === weeks.length - 1,
                            }))}
                        />
                    </View>
                </ListSection>
                {balance.some((entry) => entry.count > 0) && (
                    <ListSection title={t('muscleBalanceLastWeeks', { count: BALANCE_DAYS / 7 })}>
                        <MuscleBalanceBars entries={balance} />
                    </ListSection>
                )}
            </ScrollView>
        )
    }

    return (
        <ScreenLayout>
            {showSkeleton ? (
                <HistoryListSkeleton />
            ) : loadError && workouts.length === 0 ? (
                <View style={styles.centered}>
                    <EmptyState message={loadError} icon={'exclamation-circle'} />
                    <Button label={t('retry')} onPress={() => loadData(true)} />
                </View>
            ) : (
                <View style={styles.fill}>
                    <View style={styles.switcher}>
                        <SegmentedControl
                            segments={viewSegments}
                            value={view}
                            onChange={setView}
                            accessibilityLabel={t('history')}
                        />
                    </View>
                    {body()}
                </View>
            )}
        </ScreenLayout>
    )
}

const styles = StyleSheet.create({
    fill: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        gap: Spacing.md,
    },
    switcher: {
        paddingBottom: Spacing.sm,
    },
    listContent: {
        paddingBottom: Spacing.xl,
    },
    sectionHeader: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.sm,
    },
    sectionGap: {
        height: Spacing.xs,
    },
    scrollContent: {
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.xl,
    },
    stats: {
        gap: Spacing.lg,
    },
    calendar: {
        borderRadius: Radius.md,
        paddingVertical: Spacing.xs,
        overflow: 'hidden',
    },
    dayList: {
        gap: Spacing.sm,
        paddingTop: Spacing.lg,
    },
    inset: {
        paddingHorizontal: Spacing.md,
    },
    chart: {
        padding: Spacing.md,
    },
    emptyLine: {
        textAlign: 'center',
        paddingVertical: Spacing.xl,
    },
})
