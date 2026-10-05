import FontAwesome from '@expo/vector-icons/FontAwesome'
import * as Haptics from 'expo-haptics'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Keyboard, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import type { Exercise } from '@/src/db/exercises'
import type { HistorySet } from '@/src/db/workouts'
import { Button } from '@/src/modules/core/components/Button'
import { confirmDialog } from '@/src/modules/core/components/ConfirmDialog'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { OverflowMenu, type OverflowMenuItem } from '@/src/modules/core/components/OverflowMenu'
import { ScreenLayout, ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { showToast } from '@/src/modules/core/utils/toast'
import { ExercisePicker } from '@/src/modules/exercises/components/ExercisePicker'
import { TimerSetupModal } from '@/src/modules/timer/components/TimerSetupModal'
import { formatHourMinute, formatLocalizedDate } from '@/src/utils/dateTime'
import { EditTimingModal } from '../components/EditTimingModal'
import { ElapsedTime } from '../components/ElapsedTime'
import { ExerciseBlock, type ExerciseBlockHandlers } from '../components/ExerciseBlock'
import { FinishSummarySheet, type WorkoutSummary } from '../components/FinishSummarySheet'
import { useWorkoutDraft } from '../hooks/useWorkoutDraft'
import { useWorkoutSession } from '../hooks/useWorkoutSession'
import {
    buildBlocks,
    countPendingRows,
    countPersonalRecords,
    type DraftRow,
    EMPTY_DRAFT,
    performedBefore,
    pickPreviousSets,
    prefillRow,
    rowPayload,
    valuesFromSet,
    workoutDurationMinutes,
    workoutVolume,
} from '../liveWorkout'

type WorkoutSessionScreenProps = {
    origin?: 'workout' | 'history'
}

let rowCounter = 0
const newRowKey = () => `row-${Date.now().toString(36)}-${(rowCounter++).toString(36)}`

const toLocalTimeInput = (value?: string) => {
    if (!value) return ''
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const toIsoDateTime = (date: string, time: string) => {
    const normalizedTime = time.trim()
    const dateTime = new Date(`${date}T${normalizedTime.length === 5 ? `${normalizedTime}:00` : normalizedTime}`)
    if (Number.isNaN(dateTime.getTime())) return null
    return dateTime.toISOString()
}

export default function WorkoutSessionScreen({ origin = 'workout' }: WorkoutSessionScreenProps) {
    const { t, i18n } = useTranslation()
    const { theme } = useTheme()
    const navigation = useNavigation()
    const session = useWorkoutSession(origin)
    const { workout, sets, exercises, liveExercises, templatePriority, loading, loadError, loadData, isSavingSet } =
        session
    const draftControls = useWorkoutDraft(workout?.uuid)
    const { draft, isLoaded: isDraftLoaded, update, discard } = draftControls

    const [isEditingFinished, setIsEditingFinished] = useState(false)
    const [pickerVisible, setPickerVisible] = useState(false)
    const [timerVisible, setTimerVisible] = useState(false)
    const [timing, setTiming] = useState<{ date: string; start: string; end: string } | null>(null)
    const [isSavingTiming, setIsSavingTiming] = useState(false)
    const [summary, setSummary] = useState<WorkoutSummary | null>(null)
    const [history, setHistory] = useState<HistorySet[]>([])

    const isFinished = workout?.status === 'finished'
    const readOnly = isFinished && !isEditingFinished
    const originTabRoot = origin === 'history' ? ('/(tabs)/history' as const) : ('/(tabs)/workout' as const)

    const exerciseById = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises])
    const typeOf = useCallback((exerciseId: number) => exerciseById.get(exerciseId)?.type, [exerciseById])

    const blocks = useMemo(
        () => buildBlocks(sets, readOnly ? EMPTY_DRAFT : draft).filter((block) => exerciseById.has(block.exerciseId)),
        [draft, exerciseById, readOnly, sets]
    )

    // Earlier Sets of the Exercises on screen: last time's values for PREVIOUS
    // and pre-filling, and the baseline for records on the summary.
    const blockIdsKey = blocks.map((block) => block.exerciseId).join(',')
    const { getFinishedExerciseSets, workoutId } = session
    useEffect(() => {
        const ids = blockIdsKey ? blockIdsKey.split(',').map(Number) : []
        let cancelled = false
        getFinishedExerciseSets(ids, workoutId)
            .then((rows) => {
                if (!cancelled) setHistory(rows)
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [blockIdsKey, getFinishedExerciseSets, workoutId])
    // Editing an old Workout compares it with what came before it.
    const earlier = useMemo(
        () =>
            isFinished && workout?.date && workout.start_time
                ? performedBefore(history, workout.date, workout.start_time)
                : history,
        [history, isFinished, workout?.date, workout?.start_time]
    )
    const previous = useMemo(() => pickPreviousSets(earlier), [earlier])
    const previousRef = useRef(previous)
    previousRef.current = previous

    const blocksRef = useRef(blocks)
    blocksRef.current = blocks
    const draftRef = useRef(draft)
    draftRef.current = draft
    // Rows of an Exercise that is no longer shown (deleted with no Sets here)
    // are not counted as unchecked: the user cannot see or check them.
    const shownIds = useMemo(() => new Set(blocks.map((block) => block.exerciseId)), [blocks])

    // --- Set rows -------------------------------------------------------------

    const { addSet, updateSet, deleteSet } = session

    // ✓ and unticking run once per row: a second tap while the write is
    // still running is ignored instead of logging the Set twice.
    const rowWrites = useRef(new Set<string>())
    const once = useCallback(async (key: string, write: () => Promise<void>) => {
        if (rowWrites.current.has(key)) return
        rowWrites.current.add(key)
        try {
            await write()
        } finally {
            rowWrites.current.delete(key)
        }
    }, [])

    // Logged rows that may hold an edit still being typed (see LoggedSet).
    const rowFlushes = useRef(new Set<() => Promise<boolean>>())
    const registerFlush = useCallback((flush: () => Promise<boolean>) => {
        rowFlushes.current.add(flush)
        return () => {
            rowFlushes.current.delete(flush)
        }
    }, [])

    // Hides the keyboard and saves what logged rows still hold; false when a
    // row could not save (it then shows its stored values again).
    const flushRows = useCallback(async () => {
        Keyboard.dismiss()
        const results = await Promise.all([...rowFlushes.current].map((flush) => flush()))
        return results.every(Boolean)
    }, [])

    const handlers = useMemo<ExerciseBlockHandlers>(
        () => ({
            onRegisterFlush: registerFlush,
            onLogDraft: (exercise, row) =>
                once(`row:${row.key}`, async () => {
                    const { data, hasAnyData } = rowPayload(exercise.type, row.values, row.subSets)
                    if (!hasAnyData) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
                        return
                    }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    if (await addSet(exercise.id, data)) {
                        update({ type: 'removeRow', exerciseId: exercise.id, key: row.key })
                    }
                }),
            onUnlog: (exercise, set, values, subSets) =>
                once(`set:${set.id}`, async () => {
                    if (await deleteSet(set.id)) {
                        update({ type: 'addRow', exerciseId: exercise.id, row: { key: newRowKey(), values, subSets } })
                    }
                }),
            onEditLogged: async (exercise, set, values, subSets) => {
                // Unticking is already turning this Set back into a draft row,
                // carrying the edit with it; the row shows the stored values.
                if (rowWrites.current.has(`set:${set.id}`)) return false
                const { data, hasAnyData } = rowPayload(exercise.type, values, subSets)
                return hasAnyData ? updateSet(set.id, data) : false
            },
            onDeleteLogged: (set) =>
                confirmDialog({
                    title: t('deleteSetTitle'),
                    message: t('deleteSetConfirm'),
                    confirmLabel: t('delete'),
                    destructive: true,
                    onConfirm: async () => {
                        await deleteSet(set.id)
                    },
                }),
            onDraftValue: (exerciseId, key, field, value) =>
                update({ type: 'updateValue', exerciseId, key, field, value }),
            onDraftCopy: (exerciseId, key, values) => update({ type: 'setValues', exerciseId, key, values }),
            onDraftToggleDrop: (exerciseId, key) => update({ type: 'toggleDrop', exerciseId, key }),
            onDraftSubSet: (exerciseId, key, index, field, value) =>
                update({ type: 'updateSubSet', exerciseId, key, index, field, value }),
            onDraftAddSubSet: (exerciseId, key) => update({ type: 'addSubSet', exerciseId, key }),
            onDraftRemoveSubSet: (exerciseId, key, index) => update({ type: 'removeSubSet', exerciseId, key, index }),
            onDraftRemove: (exerciseId, key) => update({ type: 'removeRow', exerciseId, key }),
            onAddSet: (exercise) => {
                const block = blocksRef.current.find((b) => b.exerciseId === exercise.id)
                const logged = block?.logged ?? []
                const drafts = block?.drafts ?? []
                const lastDraft = drafts.at(-1)
                const lastLogged = logged.at(-1)
                const above = lastDraft ? lastDraft.values : lastLogged ? valuesFromSet(lastLogged) : null
                const row: DraftRow = {
                    key: newRowKey(),
                    values: prefillRow(
                        previousRef.current.get(exercise.id) ?? [],
                        logged.length + drafts.length,
                        above
                    ),
                    subSets: null,
                }
                update({ type: 'addRow', exerciseId: exercise.id, row })
            },
            onRemoveExercise: (exercise, loggedCount) => {
                const remove = () => update({ type: 'removeExercise', exerciseId: exercise.id })
                const filledRows = countPendingRows(draftRef.current, new Set([exercise.id]))
                if (loggedCount === 0 && filledRows === 0) {
                    remove()
                    return
                }
                confirmDialog({
                    title: t('removeExerciseTitle', { name: exercise.name }),
                    // Logged Sets are deleted; filled-in rows are only discarded.
                    message:
                        loggedCount > 0
                            ? t('removeExerciseMessage')
                            : t('removeExerciseRowsMessage', { count: filledRows }),
                    confirmLabel: t('remove'),
                    destructive: true,
                    onConfirm: async () => {
                        const block = blocksRef.current.find((b) => b.exerciseId === exercise.id)
                        for (const set of block?.logged ?? []) await deleteSet(set.id)
                        remove()
                    },
                })
            },
        }),
        [addSet, deleteSet, once, registerFlush, t, update, updateSet]
    )

    // New Exercises arrive with as many rows as last time (at least one),
    // each pre-filled from the matching Set of last time.
    const addExercises = useCallback(
        async (chosen: Exercise[]) => {
            const ids = chosen.map((exercise) => exercise.id)
            const rows = await getFinishedExerciseSets(ids, workoutId).catch(() => [] as HistorySet[])
            const lastTime = pickPreviousSets(rows)
            update({
                type: 'addExercises',
                exerciseIds: ids,
                rowsFor: (exerciseId) => {
                    const prior = lastTime.get(exerciseId) ?? []
                    return Array.from({ length: Math.max(1, prior.length) }, (_, index) => ({
                        key: newRowKey(),
                        values: prefillRow(prior, index, null),
                        subSets: null,
                    }))
                },
            })
        },
        [getFinishedExerciseSets, update, workoutId]
    )

    const pickerCandidates = useMemo(() => {
        const onScreen = new Set(blocks.map((block) => block.exerciseId))
        return liveExercises.filter((exercise) => !onScreen.has(exercise.id))
    }, [blocks, liveExercises])

    // --- Finish -----------------------------------------------------------------

    const { finishWorkout, deleteWorkout } = session

    // Deletes the Workout, then its draft; a failed delete keeps both.
    const removeWorkout = useCallback(async () => {
        if (await deleteWorkout()) await discard()
    }, [deleteWorkout, discard])

    // Finishing runs once, however often Finish or the dialog is tapped.
    const isFinishing = useRef(false)
    const hasFinished = useRef(false)
    const completeFinish = useCallback(async () => {
        if (isFinishing.current || hasFinished.current) return
        isFinishing.current = true
        try {
            const finished = await finishWorkout()
            if (!finished) return
            hasFinished.current = true
            await discard()
            setSummary({
                durationMinutes: workoutDurationMinutes(finished.start_time, finished.end_time),
                setCount: sets.length,
                volumeKg: workoutVolume(sets, typeOf),
                records: countPersonalRecords(sets, history, typeOf),
            })
        } finally {
            isFinishing.current = false
        }
    }, [discard, finishWorkout, history, sets, typeOf])

    const evaluateFinish = useCallback(() => {
        const pending = countPendingRows(draft, shownIds)
        if (sets.length === 0) {
            confirmDialog({
                title: t('discardWorkoutTitle'),
                // Filled-in rows that were never checked are not saved either; say so.
                message: pending > 0 ? t('discardWithPending', { count: pending }) : t('discardWorkoutMessage'),
                confirmLabel: t('discard'),
                destructive: true,
                onConfirm: removeWorkout,
            })
            return
        }
        if (pending > 0) {
            confirmDialog({
                title: t('finishWorkoutTitle'),
                message: t('finishWithPending', { count: pending }),
                confirmLabel: t('finish'),
                onConfirm: completeFinish,
            })
            return
        }
        completeFinish()
    }, [completeFinish, draft, removeWorkout, sets.length, shownIds, t])

    // Finish first saves edits still being typed in logged rows, then waits
    // for a Set that is still being saved (✓ then straight to Finish), so it
    // counts the Sets and rows as they end up.
    const [finishRequested, setFinishRequested] = useState(false)
    const isFlushing = useRef(false)
    const handleFinish = useCallback(async () => {
        if (isFinishing.current || isFlushing.current) return
        isFlushing.current = true
        let saved = false
        try {
            saved = await flushRows()
        } finally {
            isFlushing.current = false
        }
        // A failed save leaves the row on its stored values for the user to retry.
        if (saved) setFinishRequested(true)
    }, [flushRows])
    useEffect(() => {
        if (!finishRequested || isSavingSet) return
        setFinishRequested(false)
        evaluateFinish()
    }, [evaluateFinish, finishRequested, isSavingSet])

    const handleDelete = useCallback(() => {
        confirmDialog({
            title: t('deleteWorkoutTitle'),
            message: t('deleteWorkoutConfirm'),
            confirmLabel: t('delete'),
            destructive: true,
            onConfirm: removeWorkout,
        })
    }, [removeWorkout, t])

    // Leaving edit mode on a finished Workout: unchecked rows are not saved,
    // so say so first, then drop them rather than keep them hidden.
    const { reset: resetDraft } = draftControls
    const handleDoneEditing = useCallback(() => {
        const pending = countPendingRows(draft, shownIds)
        const leave = async () => {
            if (!(await flushRows())) return
            await resetDraft()
            setIsEditingFinished(false)
        }
        if (pending === 0) {
            leave()
            return
        }
        confirmDialog({
            title: t('stopEditingTitle'),
            message: t('finishWithPending', { count: pending }),
            confirmLabel: t('discard'),
            destructive: true,
            onConfirm: leave,
        })
    }, [draft, flushRows, resetDraft, shownIds, t])

    const closeSummary = useCallback(() => {
        setSummary(null)
        router.dismissTo(originTabRoot)
    }, [originTabRoot])

    const { saveAsTemplate } = session
    const handleSaveAsTemplate = useCallback(
        (name: string) => {
            const uuids = blocks.flatMap((block) => {
                const uuid = exerciseById.get(block.exerciseId)?.uuid
                return uuid && block.logged.length > 0 ? [uuid] : []
            })
            return saveAsTemplate(name, uuids)
        },
        [blocks, exerciseById, saveAsTemplate]
    )

    // --- Timing -----------------------------------------------------------------

    const { updateWorkoutTiming } = session
    const openTiming = useCallback(() => {
        if (!workout) return
        setTiming({
            date: workout.date ?? '',
            start: toLocalTimeInput(workout.start_time),
            end: toLocalTimeInput(workout.end_time),
        })
    }, [workout])

    const saveTiming = async () => {
        if (!timing) return
        const nextStart = toIsoDateTime(timing.date, timing.start)
        if (!nextStart) {
            showToast.danger({ title: t('error'), message: t('invalidDateTime') })
            return
        }
        let nextEnd: string | undefined
        if (timing.end.trim().length > 0) {
            const parsedEnd = toIsoDateTime(timing.date, timing.end)
            if (!parsedEnd) {
                showToast.danger({ title: t('error'), message: t('invalidDateTime') })
                return
            }
            if (new Date(parsedEnd).getTime() < new Date(nextStart).getTime()) {
                showToast.danger({ title: t('error'), message: t('invalidTimeRange') })
                return
            }
            nextEnd = parsedEnd
        }
        setIsSavingTiming(true)
        const saved = await updateWorkoutTiming(timing.date, nextStart, nextEnd)
        setIsSavingTiming(false)
        if (saved) setTiming(null)
    }

    // --- Header -----------------------------------------------------------------

    const title = templatePriority.templateName ?? t('workout')
    useFocusEffect(
        useCallback(() => {
            const menuItems: OverflowMenuItem[] = isFinished
                ? [
                      {
                          key: 'edit',
                          label: t('editWorkout'),
                          icon: 'pencil',
                          onPress: () => setIsEditingFinished(true),
                      },
                      { key: 'timing', label: t('editTime'), icon: 'clock-o', onPress: openTiming },
                      {
                          key: 'delete',
                          label: t('deleteWorkout'),
                          icon: 'trash',
                          destructive: true,
                          onPress: handleDelete,
                      },
                  ]
                : [
                      {
                          key: 'delete',
                          label: t('deleteWorkout'),
                          icon: 'trash',
                          destructive: true,
                          onPress: handleDelete,
                      },
                  ]

            navigation.getParent()?.setOptions({
                headerTitle: () => (
                    <HeaderTitle title={title} startTime={isFinished ? undefined : workout?.start_time} />
                ),
                headerLeft: () => (
                    <TouchableOpacity
                        onPress={() => (router.canGoBack() ? router.back() : router.replace(originTabRoot))}
                        style={styles.headerBack}
                        accessibilityRole={'button'}
                        accessibilityLabel={t('back')}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                        <FontAwesome name={'chevron-left'} size={20} color={theme.text} />
                    </TouchableOpacity>
                ),
                headerRight: () =>
                    workout ? (
                        <View style={styles.headerActions}>
                            {!isFinished && (
                                <TouchableOpacity
                                    onPress={() => setTimerVisible(true)}
                                    style={styles.headerIcon}
                                    accessibilityRole={'button'}
                                    accessibilityLabel={t('timer')}
                                >
                                    <FontAwesome name={'hourglass-half'} size={18} color={theme.text} />
                                </TouchableOpacity>
                            )}
                            {!isFinished && (
                                <Button
                                    label={t('finish')}
                                    variant={'text'}
                                    onPress={handleFinish}
                                    style={styles.headerButton}
                                />
                            )}
                            {isFinished && isEditingFinished ? (
                                <Button
                                    label={t('done')}
                                    variant={'text'}
                                    onPress={handleDoneEditing}
                                    style={styles.headerButton}
                                />
                            ) : (
                                <OverflowMenu placement={'topBar'} items={menuItems} />
                            )}
                        </View>
                    ) : null,
            })
        }, [
            handleDelete,
            handleDoneEditing,
            handleFinish,
            isEditingFinished,
            isFinished,
            navigation,
            openTiming,
            originTabRoot,
            t,
            theme,
            title,
            workout,
        ])
    )

    if (loading && !workout) {
        return (
            <ScreenLayout style={styles.centered}>
                <ActivityIndicator size={'large'} color={theme.primary} />
            </ScreenLayout>
        )
    }

    if (loadError && !workout) {
        return (
            <ScreenLayout style={styles.centered}>
                <EmptyState message={loadError} icon={'exclamation-circle'} />
                <Button label={t('retry')} onPress={loadData} />
            </ScreenLayout>
        )
    }

    const finishedLine =
        isFinished && workout
            ? [
                  formatLocalizedDate(
                      workout.start_time,
                      i18n.language,
                      { weekday: 'short', month: 'short', day: 'numeric' },
                      true
                  ),
                  workout.end_time
                      ? `${formatHourMinute(workout.start_time)}–${formatHourMinute(workout.end_time)}`
                      : formatHourMinute(workout.start_time),
                  t('setsCount', { count: sets.length }),
              ].join(' · ')
            : null

    return (
        <ScrollScreenLayout keyboardShouldPersistTaps={'handled'} contentContainerStyle={styles.content}>
            <View style={styles.stack}>
                {finishedLine && (
                    <Typography.Label color={'textSecondary'} numeric style={styles.inset}>
                        {finishedLine}
                    </Typography.Label>
                )}

                {isDraftLoaded &&
                    blocks.map((block) => {
                        const exercise = exerciseById.get(block.exerciseId)
                        if (!exercise) return null
                        return (
                            <ExerciseBlock
                                key={block.exerciseId}
                                exercise={exercise}
                                logged={block.logged}
                                drafts={block.drafts}
                                previous={previous.get(block.exerciseId) ?? []}
                                readOnly={readOnly}
                                {...handlers}
                            />
                        )
                    })}

                {isDraftLoaded && blocks.length === 0 && (
                    <Typography.Body color={'textSecondary'} style={styles.emptyLine}>
                        {readOnly ? t('noSetsRecorded') : t('addFirstExercise')}
                    </Typography.Body>
                )}

                {!readOnly && isDraftLoaded && (
                    <Button
                        label={t('addExercise')}
                        leftIcon={'plus'}
                        variant={'secondary'}
                        onPress={() => setPickerVisible(true)}
                    />
                )}
            </View>

            <ExercisePicker
                visible={pickerVisible}
                onClose={() => setPickerVisible(false)}
                title={t('addExercise')}
                exercises={pickerCandidates}
                priorityUuids={templatePriority.priorityUuids}
                prioritySectionTitle={templatePriority.templateName ?? undefined}
                onAdd={addExercises}
            />
            <TimerSetupModal visible={timerVisible} onClose={() => setTimerVisible(false)} />
            <EditTimingModal
                visible={timing !== null}
                language={i18n.language}
                date={timing?.date ?? ''}
                startTime={timing?.start ?? ''}
                endTime={timing?.end ?? ''}
                onChangeDate={(date) => setTiming((current) => current && { ...current, date })}
                onChangeStartTime={(start) => setTiming((current) => current && { ...current, start })}
                onChangeEndTime={(end) => setTiming((current) => current && { ...current, end })}
                onSave={saveTiming}
                onClose={() => setTiming(null)}
                isSaving={isSavingTiming}
            />
            <FinishSummarySheet
                visible={summary !== null}
                onClose={closeSummary}
                summary={summary}
                canSaveAsTemplate={!workout?.template_uuid}
                defaultTemplateName={
                    workout ? formatLocalizedDate(workout.start_time, i18n.language, { weekday: 'long' }, true) : ''
                }
                onSaveAsTemplate={handleSaveAsTemplate}
            />
        </ScrollScreenLayout>
    )
}

// The header title, with the running clock under it while the Workout runs.
function HeaderTitle({ title, startTime }: { title: string; startTime?: string }) {
    return (
        <View style={styles.headerTitle}>
            <Typography.Body weight={'semibold'} numberOfLines={1}>
                {title}
            </Typography.Body>
            {startTime && <ElapsedTime startTime={startTime} />}
        </View>
    )
}

const styles = StyleSheet.create({
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.md,
    },
    content: {
        paddingBottom: Spacing.xxl * 2,
    },
    stack: {
        gap: Spacing.md,
    },
    inset: {
        paddingHorizontal: Spacing.xs,
    },
    emptyLine: {
        textAlign: 'center',
        paddingVertical: Spacing.lg,
    },
    headerTitle: {
        alignItems: 'center',
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
        gap: Spacing.xs,
        marginRight: Spacing.xs,
    },
    headerIcon: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerButton: {
        minHeight: 44,
        paddingHorizontal: Spacing.sm,
    },
})
