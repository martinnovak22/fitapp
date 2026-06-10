import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getRepositories } from '@/src/data/repositories'
import type { Exercise } from '@/src/db/exercises'
import type { SetData, Workout, Set as WorkoutSet } from '@/src/db/workouts'
import { showToast } from '@/src/modules/core/utils/toast'

type SetWithExercise = WorkoutSet & { exercise_name: string }
type SessionOrigin = 'workout' | 'history'

export function useWorkoutSession(origin: SessionOrigin = 'workout') {
    const { exercises: exerciseRepo, workouts: workoutRepo } = getRepositories()
    const { t } = useTranslation()
    const { id } = useLocalSearchParams()
    const workoutId = Number(id)
    const originTabRoot = origin === 'history' ? ('/(tabs)/history' as const) : ('/(tabs)/workout' as const)

    const [workout, setWorkout] = useState<Workout | null>(null)
    const [sets, setSets] = useState<SetWithExercise[]>([])
    const [exercises, setExercises] = useState<Exercise[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isSavingSet, setIsSavingSet] = useState(false)
    const [isSavingWorkoutTime, setIsSavingWorkoutTime] = useState(false)
    const [isFinishingWorkout, setIsFinishingWorkout] = useState(false)
    const [isDeletingWorkout, setIsDeletingWorkout] = useState(false)

    const loadSets = useCallback(async () => {
        if (!Number.isFinite(workoutId) || workoutId <= 0) return
        const nextSets = await workoutRepo.getSets(workoutId)
        setSets(nextSets as SetWithExercise[])
    }, [workoutId, workoutRepo])

    const loadData = useCallback(async () => {
        if (!Number.isFinite(workoutId) || workoutId <= 0) {
            setLoadError(t('failedToLoadWorkoutSession'))
            setLoading(false)
            return
        }
        setLoading(true)
        setLoadError(null)

        try {
            const [w, s, ex] = await Promise.all([
                workoutRepo.getById(workoutId),
                workoutRepo.getSets(workoutId),
                exerciseRepo.getAll(),
            ])

            if (!w) {
                router.replace('/(tabs)/workout')
                return
            }

            setWorkout(w)
            setSets(s as SetWithExercise[])
            setExercises(ex)
        } catch (e) {
            console.error('Failed to load workout session:', e)
            setLoadError(t('failedToLoadWorkoutSession'))
        } finally {
            setLoading(false)
        }
    }, [exerciseRepo, t, workoutId, workoutRepo])

    useFocusEffect(
        useCallback(() => {
            loadData()
        }, [loadData])
    )

    const runSetMutation = useCallback(
        async (mutation: () => Promise<void>, successMessage: string, refresh: () => Promise<void> = loadSets) => {
            setIsSavingSet(true)
            try {
                await mutation()
                await refresh()
                showToast.success({ title: t('success'), message: successMessage })
                return true
            } catch (e) {
                console.error('Failed to persist set mutation:', e)
                await loadData()
                showToast.danger({ title: t('error'), message: t('failedToSaveSet') })
                return false
            } finally {
                setIsSavingSet(false)
            }
        },
        [loadData, loadSets, t]
    )

    const addSet = async (exerciseId: number, data: SetData) => {
        return runSetMutation(() => workoutRepo.addSet(workoutId, exerciseId, data), t('newSetAdded'))
    }

    const updateSet = async (setId: number, data: SetData) => {
        return runSetMutation(() => workoutRepo.updateSet(setId, data), t('changesSaved'))
    }

    const deleteSet = (setId: number) => {
        showToast.confirm({
            title: t('deleteSetTitle'),
            message: t('removeSetConfirm'),
            icon: 'trash',
            tone: 'danger',
            action: {
                label: t('delete'),
                onPress: async () => {
                    try {
                        await workoutRepo.deleteSet(setId)
                        await loadSets()
                        showToast.success({ title: t('setDeleted'), message: t('setRemoved') })
                    } catch (e) {
                        console.error('Failed to delete set:', e)
                        await loadData()
                        showToast.danger({ title: t('error'), message: t('failedToSaveSet') })
                    }
                },
            },
        })
    }

    const finishWorkout = () => {
        showToast.confirm({
            title: t('finishWorkout'),
            message: t('finishSessionConfirm'),
            action: {
                label: t('finish'),
                onPress: async () => {
                    if (isFinishingWorkout) return
                    setIsFinishingWorkout(true)
                    try {
                        await workoutRepo.finish(workoutId)
                        router.dismissTo(originTabRoot)
                        showToast.success({ title: t('workoutFinished'), message: t('greatJob') })
                    } catch (e) {
                        console.error('Failed to finish workout:', e)
                        showToast.danger({ title: t('error'), message: t('failedToFinishWorkout') })
                    } finally {
                        setIsFinishingWorkout(false)
                    }
                },
            },
        })
    }

    const deleteWorkout = () => {
        showToast.confirm({
            title: t('deleteWorkoutTitle'),
            message: t('deleteWorkoutConfirm'),
            icon: 'trash',
            tone: 'danger',
            action: {
                label: t('delete'),
                onPress: async () => {
                    if (isDeletingWorkout) return
                    setIsDeletingWorkout(true)
                    try {
                        await workoutRepo.delete(workoutId)
                        if (router.canGoBack()) {
                            router.back()
                        } else {
                            router.replace(originTabRoot)
                        }
                        showToast.success({ title: t('workoutDeleted'), message: t('workoutRemoved') })
                    } catch (e) {
                        console.error('Failed to delete workout:', e)
                        showToast.danger({ title: t('error'), message: t('failedToDeleteWorkout') })
                    } finally {
                        setIsDeletingWorkout(false)
                    }
                },
            },
        })
    }

    const updateWorkoutTiming = useCallback(
        async (date: string, startTime: string, endTime?: string) => {
            setIsSavingWorkoutTime(true)
            try {
                await workoutRepo.updateTiming(workoutId, date, startTime, endTime)
                await loadData()
                showToast.success({ title: t('success'), message: t('changesSaved') })
                return true
            } catch (e) {
                console.error('Failed to update workout timing:', e)
                showToast.danger({ title: t('error'), message: t('failedToSaveWorkoutTime') })
                return false
            } finally {
                setIsSavingWorkoutTime(false)
            }
        },
        [loadData, t, workoutId, workoutRepo]
    )

    const exerciseNamesOrder = [...new Set(sets.map((s) => s.exercise_name))]
    const groupedSets = sets.reduce(
        (acc, set) => {
            if (!acc[set.exercise_name]) acc[set.exercise_name] = []
            acc[set.exercise_name].push(set)
            return acc
        },
        {} as Record<string, SetWithExercise[]>
    )

    const reorderSets = useCallback(
        async (exerciseName: string, newGroupSets: SetWithExercise[]) => {
            const previousSets = sets
            const currentGrouped = previousSets.reduce(
                (acc, currentSet) => {
                    if (!acc[currentSet.exercise_name]) acc[currentSet.exercise_name] = []
                    acc[currentSet.exercise_name].push(currentSet)
                    return acc
                },
                {} as Record<string, SetWithExercise[]>
            )

            currentGrouped[exerciseName] = newGroupSets
            const currentExerciseOrder = [...new Set(previousSets.map((item) => item.exercise_name))]

            const allNewSets: SetWithExercise[] = []
            let currentPos = 0
            currentExerciseOrder.forEach((name) => {
                const group = currentGrouped[name] || []
                group.forEach((item) => {
                    allNewSets.push({ ...item, position: currentPos++ })
                })
            })

            setSets(allNewSets)

            try {
                const setsToUpdate = allNewSets.filter((item) => item.exercise_name === exerciseName)
                await Promise.all(setsToUpdate.map((item) => workoutRepo.updateSetPosition(item.id, item.position)))
            } catch (e) {
                console.error('Failed to update positions', e)
                setSets(previousSets)
                await loadData()
            }
        },
        [loadData, sets, workoutRepo]
    )

    return {
        workout,
        sets,
        exercises,
        loading,
        loadError,
        isSavingSet,
        isSavingWorkoutTime,
        isFinishingWorkout,
        isDeletingWorkout,
        exerciseNamesOrder,
        groupedSets,
        loadData,
        addSet,
        updateSet,
        deleteSet,
        finishWorkout,
        deleteWorkout,
        reorderSets,
        updateWorkoutTiming,
    }
}
