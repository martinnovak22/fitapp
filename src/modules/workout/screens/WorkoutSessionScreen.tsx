import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { GlobalStyles } from '@/src/constants/Styles'
import { SubSet, Set as WorkoutSet } from '@/src/db/workouts'
import { Button } from '@/src/modules/core/components/Button'
import { Card } from '@/src/modules/core/components/Card'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { ScreenLayout, ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { showToast } from '@/src/modules/core/utils/toast'
import { formatLocalizedDate } from '@/src/utils/dateTime'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Modal, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import { NestedReorderableList, ScrollViewContainer, reorderItems } from 'react-native-reorderable-list'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { LogSetModal } from '../components/LogSetModal'
import { WorkoutSetItem } from '../components/WorkoutSetItem'
import { useWorkoutSession } from '../hooks/useWorkoutSession'
import { buildSetPayload, SetFormValues } from '../setPayload'
import { parseSubSets } from '../workoutUtils'

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

    const [modalVisible, setModalVisible] = useState(false)
    const [editingSetId, setEditingSetId] = useState<number | null>(null)

    const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
    const [subSets, setSubSets] = useState<SubSet[]>([])
    const [isHistoryEditMode, setIsHistoryEditMode] = useState(false)
    const [timingModalVisible, setTimingModalVisible] = useState(false)
    const [timingDate, setTimingDate] = useState('')
    const [timingStartTime, setTimingStartTime] = useState('')
    const [timingEndTime, setTimingEndTime] = useState('')
    const [inputValues, setInputValues] = useState<SetFormValues>({
        weight: '',
        reps: '',
        distance: '',
        durationMinutes: '',
        durationSeconds: '',
    })

    // We can allow default selection once exercises are loaded
    useEffect(() => {
        if (!selectedExerciseId && exercises.length > 0) {
            setSelectedExerciseId(exercises[0].id)
        }
    }, [exercises, selectedExerciseId])

    const updateInput = (key: keyof SetFormValues, value: string) => {
        setInputValues((prev) => ({ ...prev, [key]: value }))
    }

    const handleOpenAddModal = () => {
        setEditingSetId(null)
        setSubSets([])
        setInputValues({
            weight: '',
            reps: '',
            distance: '',
            durationMinutes: '',
            durationSeconds: '',
        })
        setModalVisible(true)
    }

    const handleOpenEditModal = (s: WorkoutSet) => {
        setEditingSetId(s.id)
        setSelectedExerciseId(s.exercise_id)

        let mins = ''
        let secs = ''
        if (s.duration) {
            mins = Math.floor(s.duration).toString()
            secs = Math.round((s.duration - Math.floor(s.duration)) * 60).toString()
        }

        setSubSets(parseSubSets(s.sub_sets))

        setInputValues({
            weight: s.weight?.toString() || '',
            reps: s.reps?.toString() || '',
            distance: s.distance?.toString() || '',
            durationMinutes: mins,
            durationSeconds: secs,
        })
        setModalVisible(true)
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
            setModalVisible(false)
            return
        }

        let success = false
        if (editingSetId) {
            success = await updateSet(editingSetId, data)
        } else {
            success = await addSet(selectedExerciseId, data)
        }

        if (success) {
            setModalVisible(false)
            setEditingSetId(null)
            setSubSets([])
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

    const isFinishedWorkout = workout?.status === 'finished'
    const canEditHistoryWorkout = origin === 'history' && isFinishedWorkout
    const isReadOnly = isFinishedWorkout && !isHistoryEditMode
    const canFinishWorkout = !isFinishedWorkout

    const openTimingModal = () => {
        if (!workout) return
        setTimingDate(workout.date ?? '')
        setTimingStartTime(toLocalTimeInput(workout.start_time))
        setTimingEndTime(toLocalTimeInput(workout.end_time))
        setTimingModalVisible(true)
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
            setTimingModalVisible(false)
        }
    }

    const parentTabFallback = origin === 'history' ? '/(tabs)/history' : '/(tabs)/workout'

    useFocusEffect(
        useCallback(() => {
            const rightAction = canEditHistoryWorkout
                ? {
                      icon: isHistoryEditMode ? ('check' as const) : ('pencil' as const),
                      accessibilityLabel: isHistoryEditMode ? t('save') : t('edit'),
                      onPress: () => setIsHistoryEditMode((prev) => !prev),
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
                        onPress={() => (router.canGoBack() ? router.back() : router.replace(parentTabFallback as Parameters<typeof router.replace>[0]))}
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
            canEditHistoryWorkout,
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
                <ActivityIndicator size={"large"} color={theme.primary} />
            </ScreenLayout>
        )
    }

    if (loadError && !workout) {
        return (
            <ScreenLayout style={styles.loadingContainer}>
                <EmptyState message={loadError} icon={"exclamation-circle"} />
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
                            <FontAwesome name={'plus'} size={32} color={theme.onPrimary} />
                        </TouchableOpacity>
                    )}

                    <LogSetModal
                        visible={modalVisible}
                        onClose={() => setModalVisible(false)}
                        onSave={handleSaveSet}
                        editingSetId={editingSetId}
                        exercises={exercises}
                        selectedExerciseId={selectedExerciseId}
                        setSelectedExerciseId={setSelectedExerciseId}
                        subSets={subSets}
                        setSubSets={setSubSets}
                        inputValues={inputValues}
                        updateInput={updateInput}
                        isSaving={isSavingSet}
                    />
                </>
            }
        >
            {canEditHistoryWorkout && (
                <Card style={[styles.timingCard, { borderColor: theme.border, backgroundColor: theme.surfaceSubtle }]}>
                    <View style={styles.timingHeader}>
                        <Typography.Meta style={{ color: theme.textSecondary }}>{t('workoutTiming')}</Typography.Meta>
                        <TouchableOpacity onPress={openTimingModal} accessibilityRole={'button'}>
                            <Typography.Meta color={'primary'} weight={'bold'}>{t('editTime')}</Typography.Meta>
                        </TouchableOpacity>
                    </View>
                    <Typography.Body>{`${t('startedAt')}: ${formatLocalizedDate(
                        workout?.start_time || '',
                        i18n.language,
                        { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
                        true
                    )}`}</Typography.Body>
                    <Typography.Body style={{ marginTop: Spacing.xs }}>
                        {`${t('time')}: ${
                            workout?.end_time
                                ? `${formatLocalizedDate(
                                      workout.end_time,
                                      i18n.language,
                                      { hour: '2-digit', minute: '2-digit' },
                                      true
                                  )}`
                                : t('notSpecified')
                        }`}
                    </Typography.Body>
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

            <Modal visible={timingModalVisible} transparent animationType={'fade'} onRequestClose={() => setTimingModalVisible(false)}>
                <View style={[styles.modalBackdrop, { backgroundColor: theme.overlayBackdrop }]}>
                    <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <Typography.Subtitle style={{ marginBottom: Spacing.md }}>{t('editTime')}</Typography.Subtitle>

                        <View style={{ gap: Spacing.sm }}>
                            <Typography.Label>{t('workoutDate')}</Typography.Label>
                            <TextInput
                                value={timingDate}
                                onChangeText={setTimingDate}
                                placeholder={'YYYY-MM-DD'}
                                placeholderTextColor={theme.textSecondary}
                                style={[
                                    styles.modalInput,
                                    { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.border },
                                ]}
                                autoCapitalize={'none'}
                                keyboardType={'numbers-and-punctuation'}
                            />
                        </View>

                        <View style={{ gap: Spacing.sm }}>
                            <Typography.Label>{t('startTime')}</Typography.Label>
                            <TextInput
                                value={timingStartTime}
                                onChangeText={setTimingStartTime}
                                placeholder={'HH:mm'}
                                placeholderTextColor={theme.textSecondary}
                                style={[
                                    styles.modalInput,
                                    { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.border },
                                ]}
                                autoCapitalize={'none'}
                                keyboardType={'numbers-and-punctuation'}
                            />
                        </View>

                        <View style={{ gap: Spacing.sm }}>
                            <Typography.Label>{t('endTime')}</Typography.Label>
                            <TextInput
                                value={timingEndTime}
                                onChangeText={setTimingEndTime}
                                placeholder={'HH:mm'}
                                placeholderTextColor={theme.textSecondary}
                                style={[
                                    styles.modalInput,
                                    { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.border },
                                ]}
                                autoCapitalize={'none'}
                                keyboardType={'numbers-and-punctuation'}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity onPress={() => setTimingModalVisible(false)} style={styles.modalCancel}>
                                <Typography.Body style={{ color: theme.error }}>{t('cancel')}</Typography.Body>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={saveTiming}
                                style={[styles.modalSave, { backgroundColor: theme.primary }, isSavingWorkoutTime && styles.modalSaveDisabled]}
                                disabled={isSavingWorkoutTime}
                            >
                                <Typography.Body color={'onPrimary'} weight={'bold'}>
                                    {isSavingWorkoutTime ? t('saving') : t('saveChanges')}
                                </Typography.Body>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    modalBackdrop: {
        flex: 1,
        justifyContent: 'center',
        padding: Spacing.md,
    },
    modalCard: {
        borderWidth: 1,
        borderRadius: Radius.md,
        padding: Spacing.md,
    },
    modalInput: {
        ...GlobalStyles.input,
        marginBottom: Spacing.sm,
    },
    modalActions: {
        marginTop: Spacing.sm,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    modalCancel: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
    },
    modalSave: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.sm,
    },
    modalSaveDisabled: {
        opacity: 0.5,
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
