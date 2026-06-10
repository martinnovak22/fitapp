import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import { useCallback, useEffect, useReducer, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { NestedReorderableList, reorderItems, ScrollViewContainer } from 'react-native-reorderable-list'
import { Spacing } from '@/src/constants/Spacing'
import { GlobalStyles } from '@/src/constants/Styles'
import type { Set as WorkoutSet } from '@/src/db/workouts'
import { Button } from '@/src/modules/core/components/Button'
import { Card } from '@/src/modules/core/components/Card'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { ScreenLayout, ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { showToast } from '@/src/modules/core/utils/toast'
import { TimerSetupModal } from '@/src/modules/timer/components/TimerSetupModal'
import { formatHourMinute, formatLocalizedDate } from '@/src/utils/dateTime'
import { EditTimingModal } from '../components/EditTimingModal'
import { LogSetModal } from '../components/LogSetModal'
import { WorkoutSetItem } from '../components/WorkoutSetItem'
import { useWorkoutSession } from '../hooks/useWorkoutSession'
import { buildSetPayload, type SetFormValues } from '../setPayload'
import {
    canEditFinishedWorkout as deriveCanEditFinishedWorkout,
    canFinishWorkout as deriveCanFinishWorkout,
    isReadOnly as deriveIsReadOnly,
    initialSessionState,
    sessionReducer,
} from '../workoutSessionReducer'

type SetWithExercise = WorkoutSet & { exercise_name: string }
type WorkoutSessionScreenProps = {
    origin?: 'workout' | 'history'
}

export default function WorkoutSessionScreen({ origin = 'workout' }: WorkoutSessionScreenProps) {
    const { t, i18n } = useTranslation()
    const { theme } = useTheme()
    const navigation = useNavigation()
    const {
        workout,
        exercises,
        loading,
        loadError,
        loadData,
        isSavingSet,
        isSavingWorkoutTime,
        isFinishingWorkout,
        isDeletingWorkout,
        exerciseNamesOrder,
        groupedSets,
        finishWorkout,
        deleteWorkout,
        deleteSet,
        reorderSets,
        addSet,
        updateSet,
        updateWorkoutTiming,
    } = useWorkoutSession(origin)

    const [timerSetupVisible, setTimerSetupVisible] = useState(false)
    const [session, dispatch] = useReducer(sessionReducer, initialSessionState)
    const {
        modalVisible,
        editingSetId,
        selectedExerciseId,
        subSets,
        isHistoryEditMode,
        timingModalVisible,
        timingDate,
        timingStartTime,
        timingEndTime,
        inputValues,
    } = session

    // We can allow default selection once exercises are loaded
    useEffect(() => {
        if (!selectedExerciseId && exercises.length > 0) {
            dispatch({ type: 'SELECT_DEFAULT_EXERCISE', exerciseId: exercises[0].id })
        }
    }, [exercises, selectedExerciseId])

    const updateInput = (key: keyof SetFormValues, value: string) => {
        dispatch({ type: 'UPDATE_INPUT', key, value })
    }

    const handleOpenAddModal = () => {
        dispatch({ type: 'OPEN_ADD_MODAL' })
    }

    const handleOpenEditModal = (s: WorkoutSet) => {
        dispatch({ type: 'OPEN_EDIT_MODAL', set: s })
    }

    const handleSaveSet = async () => {
        if (isSavingSet) return

        if (!selectedExerciseId) {
            showToast.info({ title: t('selectExercise'), message: t('selectExerciseFirst') })
            return
        }

        const selectedExercise = exercises.find((e) => e.id === selectedExerciseId)
        if (!selectedExercise) return

        const { data, hasAnyData } = buildSetPayload({
            exerciseType: selectedExercise.type,
            inputValues,
            subSets,
        })

        if (!hasAnyData) {
            showToast.info({
                title: t('emptySetIgnored'),
                message: t('emptySetIgnoredMessage'),
            })
            dispatch({ type: 'CLOSE_MODAL' })
            return
        }

        let success = false
        if (editingSetId) {
            success = await updateSet(editingSetId, data)
        } else {
            success = await addSet(selectedExerciseId, data)
        }

        if (success) {
            dispatch({ type: 'SET_SAVE_SUCCEEDED' })
        }
    }

    const toLocalTimeInput = (value?: string) => {
        if (!value) return ''
        const d = new Date(value)
        if (Number.isNaN(d.getTime())) return ''
        const hours = String(d.getHours()).padStart(2, '0')
        const mins = String(d.getMinutes()).padStart(2, '0')
        return `${hours}:${mins}`
    }

    const toIsoDateTime = (date: string, time: string) => {
        const normalizedTime = time.trim()
        const dateTime = new Date(`${date}T${normalizedTime.length === 5 ? `${normalizedTime}:00` : normalizedTime}`)
        if (Number.isNaN(dateTime.getTime())) return null
        return dateTime.toISOString()
    }

    const canEditFinishedWorkout = deriveCanEditFinishedWorkout(workout)
    const isReadOnly = deriveIsReadOnly(workout, isHistoryEditMode)
    const canFinishWorkout = deriveCanFinishWorkout(workout)

    const openTimingModal = () => {
        if (!workout) return
        dispatch({
            type: 'OPEN_TIMING_MODAL',
            date: workout.date ?? '',
            startTime: toLocalTimeInput(workout.start_time),
            endTime: toLocalTimeInput(workout.end_time),
        })
    }

    const saveTiming = async () => {
        if (!workout) return

        const nextStart = toIsoDateTime(timingDate, timingStartTime)
        if (!nextStart) {
            showToast.danger({ title: t('error'), message: t('invalidDateTime') })
            return
        }

        let nextEnd: string | undefined
        if (timingEndTime.trim().length > 0) {
            const parsedEnd = toIsoDateTime(timingDate, timingEndTime)
            if (!parsedEnd) {
                showToast.danger({ title: t('error'), message: t('invalidDateTime') })
                return
            }
            nextEnd = parsedEnd
            if (new Date(nextEnd).getTime() < new Date(nextStart).getTime()) {
                showToast.danger({ title: t('error'), message: t('invalidTimeRange') })
                return
            }
        }

        const saved = await updateWorkoutTiming(timingDate, nextStart, nextEnd)
        if (saved) {
            dispatch({ type: 'CLOSE_TIMING_MODAL' })
        }
    }

    const parentTabFallback = origin === 'history' ? '/(tabs)/history' : '/(tabs)/workout'

    useFocusEffect(
        useCallback(() => {
            const rightAction = canEditFinishedWorkout
                ? {
                      icon: isHistoryEditMode ? ('check' as const) : ('pencil' as const),
                      accessibilityLabel: isHistoryEditMode ? t('save') : t('edit'),
                      onPress: () => dispatch({ type: 'TOGGLE_HISTORY_EDIT_MODE' }),
                      disabled: false,
                  }
                : canFinishWorkout
                  ? {
                        icon: 'flag-checkered' as const,
                        accessibilityLabel: isFinishingWorkout ? t('saving') : t('finish'),
                        onPress: finishWorkout,
                        disabled: isFinishingWorkout,
                    }
                  : null

            navigation.getParent()?.setOptions({
                headerLeft: () => (
                    <TouchableOpacity
                        onPress={() =>
                            router.canGoBack()
                                ? router.back()
                                : router.replace(parentTabFallback as Parameters<typeof router.replace>[0])
                        }
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
                        <Animated.View entering={FadeIn.duration(180)} style={styles.headerActions}>
                            {canFinishWorkout && (
                                <TouchableOpacity
                                    onPress={() => setTimerSetupVisible(true)}
                                    accessibilityRole={'button'}
                                    accessibilityLabel={t('timer')}
                                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                                >
                                    <FontAwesome name={'clock-o'} size={20} color={theme.primary} />
                                </TouchableOpacity>
                            )}
                            {rightAction && (
                                <TouchableOpacity
                                    onPress={rightAction.onPress}
                                    disabled={rightAction.disabled}
                                    style={rightAction.disabled && styles.headerButtonDisabled}
                                    accessibilityRole={'button'}
                                    accessibilityLabel={rightAction.accessibilityLabel}
                                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                                >
                                    <FontAwesome name={rightAction.icon} size={20} color={theme.primary} />
                                </TouchableOpacity>
                            )}
                            {!isDeletingWorkout && (
                                <TouchableOpacity
                                    onPress={deleteWorkout}
                                    accessibilityRole={'button'}
                                    accessibilityLabel={t('delete')}
                                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                                >
                                    <FontAwesome name={'trash'} size={20} color={theme.error} />
                                </TouchableOpacity>
                            )}
                        </Animated.View>
                    ) : null,
            })
        }, [
            navigation,
            parentTabFallback,
            workout,
            canEditFinishedWorkout,
            canFinishWorkout,
            isHistoryEditMode,
            isFinishingWorkout,
            isDeletingWorkout,
            finishWorkout,
            deleteWorkout,
            theme,
            t,
        ])
    )

    if (loading && !workout) {
        return (
            <ScreenLayout style={styles.loadingContainer}>
                <ActivityIndicator size={'large'} color={theme.primary} />
            </ScreenLayout>
        )
    }

    if (loadError && !workout) {
        return (
            <ScreenLayout style={styles.loadingContainer}>
                <EmptyState message={loadError} icon={'exclamation-circle'} />
                <Button label={t('retry')} onPress={loadData} style={{ marginTop: Spacing.md }} />
            </ScreenLayout>
        )
    }

    return (
        <ScrollScreenLayout
            ScrollComponent={ScrollViewContainer}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            floatingElements={
                <>
                    {!isReadOnly && (
                        <TouchableOpacity
                            style={GlobalStyles.fab}
                            onPress={handleOpenAddModal}
                            accessibilityRole={'button'}
                            accessibilityLabel={t('addSet')}
                            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                        >
                            <FontAwesome name={'plus'} size={24} color={theme.onPrimary} />
                        </TouchableOpacity>
                    )}

                    <LogSetModal
                        visible={modalVisible}
                        onClose={() => dispatch({ type: 'CLOSE_MODAL' })}
                        onSave={handleSaveSet}
                        editingSetId={editingSetId}
                        exercises={exercises}
                        selectedExerciseId={selectedExerciseId}
                        setSelectedExerciseId={(exerciseId) => dispatch({ type: 'SET_SELECTED_EXERCISE', exerciseId })}
                        subSets={subSets}
                        setSubSets={(next) =>
                            dispatch({
                                type: 'SET_SUB_SETS',
                                subSets: typeof next === 'function' ? next(subSets) : next,
                            })
                        }
                        inputValues={inputValues}
                        updateInput={updateInput}
                        isSaving={isSavingSet}
                    />

                    <TimerSetupModal visible={timerSetupVisible} onClose={() => setTimerSetupVisible(false)} />
                </>
            }
        >
            {canEditFinishedWorkout && (
                <Card style={[styles.timingCard, { borderColor: theme.border, backgroundColor: theme.surfaceSubtle }]}>
                    <View style={styles.timingHeader}>
                        <Typography.Meta style={{ color: theme.textSecondary }}>{t('workoutTiming')}</Typography.Meta>
                        <TouchableOpacity onPress={openTimingModal} accessibilityRole={'button'}>
                            <Typography.Meta color={'primary'} weight={'bold'}>
                                {t('editTime')}
                            </Typography.Meta>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.timingRows}>
                        <TimingRow
                            label={t('workoutDate')}
                            value={
                                workout?.start_time
                                    ? formatLocalizedDate(
                                          workout.start_time,
                                          i18n.language,
                                          { year: 'numeric', month: 'short', day: 'numeric' },
                                          true
                                      )
                                    : t('notSpecified')
                            }
                        />
                        <TimingRow
                            label={t('startTime')}
                            value={workout?.start_time ? formatHourMinute(workout.start_time) : t('notSpecified')}
                        />
                        <TimingRow
                            label={t('endTime')}
                            value={workout?.end_time ? formatHourMinute(workout.end_time) : t('notSpecified')}
                        />
                    </View>
                </Card>
            )}
            {exerciseNamesOrder.length === 0 ? (
                <EmptyState message={isReadOnly ? t('noWorkoutsRecorded') : t('readyToCrush')} icon={'file-text-o'} />
            ) : (
                <Animated.View entering={FadeInDown.duration(340)}>
                    {exerciseNamesOrder.map((exerciseName) => (
                        <WorkoutExerciseGroup
                            key={exerciseName}
                            exerciseName={exerciseName}
                            sets={groupedSets[exerciseName]}
                            isReadOnly={isReadOnly}
                            handleOpenEditModal={handleOpenEditModal}
                            handleDeleteSet={deleteSet}
                            handleReorderSets={reorderSets}
                        />
                    ))}
                </Animated.View>
            )}

            <EditTimingModal
                visible={timingModalVisible}
                language={i18n.language}
                date={timingDate}
                startTime={timingStartTime}
                endTime={timingEndTime}
                onChangeDate={(value) => dispatch({ type: 'SET_TIMING_FIELD', field: 'timingDate', value })}
                onChangeStartTime={(value) => dispatch({ type: 'SET_TIMING_FIELD', field: 'timingStartTime', value })}
                onChangeEndTime={(value) => dispatch({ type: 'SET_TIMING_FIELD', field: 'timingEndTime', value })}
                onSave={saveTiming}
                onClose={() => dispatch({ type: 'CLOSE_TIMING_MODAL' })}
                isSaving={isSavingWorkoutTime}
            />
        </ScrollScreenLayout>
    )
}

interface GroupProps {
    exerciseName: string
    sets: SetWithExercise[]
    isReadOnly: boolean
    handleOpenEditModal: (s: WorkoutSet) => void
    handleDeleteSet: (id: number) => void
    handleReorderSets: (exerciseName: string, newSets: SetWithExercise[]) => void
}

function WorkoutExerciseGroup({
    exerciseName,
    sets,
    isReadOnly,
    handleOpenEditModal,
    handleDeleteSet,
    handleReorderSets,
}: GroupProps) {
    const { theme } = useTheme()

    const renderItem = useCallback(
        ({ item, index }: { item: SetWithExercise; index: number }) => {
            return (
                <WorkoutSetItem
                    set={item}
                    index={index}
                    isReadOnly={isReadOnly}
                    onEdit={handleOpenEditModal}
                    onDelete={handleDeleteSet}
                />
            )
        },
        [isReadOnly, handleOpenEditModal, handleDeleteSet]
    )

    return (
        <Card style={[styles.groupCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.groupHeader, { borderBottomColor: theme.border }]}>
                <Typography.Subtitle>{exerciseName}</Typography.Subtitle>
            </View>

            <NestedReorderableList
                data={sets}
                onReorder={({ from, to }) => {
                    const newData = reorderItems(sets, from, to)
                    handleReorderSets(exerciseName, newData)
                }}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
                renderItem={renderItem}
                shouldUpdateActiveItem
                panGesture={Gesture.Pan().activateAfterLongPress(250)}
            />
        </Card>
    )
}

function TimingRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.timingRow}>
            <Typography.Label color={'text'}>{label}</Typography.Label>
            <Typography.Label weight={'bold'} color={'text'}>
                {value}
            </Typography.Label>
        </View>
    )
}

const styles = StyleSheet.create({
    listContent: {
        paddingTop: Spacing.sm + Spacing.xs,
        paddingBottom: 100,
    },
    groupCard: {
        padding: 0,
        marginBottom: 16,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    groupHeader: {
        padding: Spacing.md,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
    },
    timingCard: {
        marginBottom: Spacing.md,
    },
    timingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    timingRows: {
        gap: Spacing.xs,
    },
    timingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
    headerButtonDisabled: {
        opacity: 0.4,
    },
})
