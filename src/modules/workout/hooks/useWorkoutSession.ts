import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useExerciseRepo, useWorkoutRepo, useWorkoutTemplateRepo } from '@/src/data/RepositoryContext'
import type { Exercise } from '@/src/db/exercises'
import type { SetData, SetWithExerciseName, Workout } from '@/src/db/workouts'
import type { WorkoutTemplate } from '@/src/db/workoutTemplates'
import { log } from '@/src/modules/core/utils/logger'
import { showToast } from '@/src/modules/core/utils/toast'
import { notifyActiveWorkoutChanged } from '../activeWorkoutSignal'
import { resolveTemplatePriority } from '../plannedExercises'

type SessionOrigin = 'workout' | 'history'

// Data and writes behind the workout screen. Confirmation, drafts and layout
// belong to the screen; this hook only loads and persists.
export function useWorkoutSession(origin: SessionOrigin = 'workout') {
    const workoutRepo = useWorkoutRepo()
    const exerciseRepo = useExerciseRepo()
    const templateRepo = useWorkoutTemplateRepo()
    const { t } = useTranslation()
    const { id } = useLocalSearchParams()
    const workoutId = Number(id)
    const originTabRoot = origin === 'history' ? ('/(tabs)/history' as const) : ('/(tabs)/workout' as const)

    const [workout, setWorkout] = useState<Workout | null>(null)
    const [sets, setSets] = useState<SetWithExerciseName[]>([])
    const [exercises, setExercises] = useState<Exercise[]>([])
    // Deleted Exercises that still have Sets here. Their Sets stay editable,
    // but the picker never offers them.
    const [deletedSetExercises, setDeletedSetExercises] = useState<Exercise[]>([])
    const [template, setTemplate] = useState<WorkoutTemplate | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    // Set writes still running; more than one can overlap.
    const [savingSetCount, setSavingSetCount] = useState(0)

    const loadSets = useCallback(async () => {
        if (!Number.isFinite(workoutId) || workoutId <= 0) return
        setSets(await workoutRepo.getSets(workoutId))
    }, [workoutId, workoutRepo])

    const loadData = useCallback(async () => {
        if (!Number.isFinite(workoutId) || workoutId <= 0) {
            setLoadError(t('failedToLoadWorkoutSession'))
            setLoading(false)
            return
        }
        setLoadError(null)

        try {
            const [w, s, ex, setEx] = await Promise.all([
                workoutRepo.getById(workoutId),
                workoutRepo.getSets(workoutId),
                exerciseRepo.getAll(),
                workoutRepo.getSetExercises(workoutId),
            ])

            if (!w) {
                router.replace(originTabRoot)
                return
            }

            // Read on every load so edits made to the Template elsewhere apply
            // to the picker of a Workout that is still running.
            const nextTemplate = w.template_uuid ? await templateRepo.getByUuid(w.template_uuid) : null

            setWorkout(w)
            setTemplate(nextTemplate)
            setSets(s)
            setExercises(ex)
            setDeletedSetExercises(setEx.filter((exercise) => exercise.deleted_at))
        } catch (e) {
            log('error', 'Failed to load workout session', e)
            setLoadError(t('failedToLoadWorkoutSession'))
        } finally {
            setLoading(false)
        }
    }, [exerciseRepo, originTabRoot, t, templateRepo, workoutId, workoutRepo])

    useFocusEffect(
        useCallback(() => {
            loadData()
        }, [loadData])
    )

    // Runs a Set write and reloads the Sets; on failure reloads everything
    // and says so. Success is silent: the row itself shows the result.
    const runSetMutation = useCallback(
        async (mutation: () => Promise<void>) => {
            setSavingSetCount((count) => count + 1)
            try {
                await mutation()
                await loadSets()
                return true
            } catch (e) {
                log('error', 'Failed to persist set mutation', e)
                await loadData()
                showToast.danger({ title: t('error'), message: t('failedToSaveSet') })
                return false
            } finally {
                setSavingSetCount((count) => count - 1)
            }
        },
        [loadData, loadSets, t]
    )

    // Resolves to the new Set's uuid, or null when the write failed.
    const addSet = useCallback(
        async (exerciseId: number, data: SetData) => {
            let uuid: string | null = null
            const saved = await runSetMutation(async () => {
                uuid = await workoutRepo.addSet(workoutId, exerciseId, data)
            })
            return saved ? uuid : null
        },
        [runSetMutation, workoutId, workoutRepo]
    )

    const saveSetOrder = useCallback(
        (updates: readonly { id: number; position: number }[]) =>
            updates.length === 0
                ? Promise.resolve(true)
                : runSetMutation(() => workoutRepo.updateSetPositions(updates)),
        [runSetMutation, workoutRepo]
    )

    const updateSet = useCallback(
        (setId: number, data: SetData) => runSetMutation(() => workoutRepo.updateSet(setId, data)),
        [runSetMutation, workoutRepo]
    )

    const deleteSet = useCallback(
        (setId: number) => runSetMutation(() => workoutRepo.deleteSet(setId)),
        [runSetMutation, workoutRepo]
    )

    const finishWorkout = useCallback(async () => {
        try {
            await workoutRepo.finish(workoutId)
            notifyActiveWorkoutChanged()
            const finished = await workoutRepo.getById(workoutId)
            if (finished) setWorkout(finished)
            return finished
        } catch (e) {
            log('error', 'Failed to finish workout', e)
            showToast.danger({ title: t('error'), message: t('failedToFinishWorkout') })
            return null
        }
    }, [t, workoutId, workoutRepo])

    const deleteWorkout = useCallback(async () => {
        try {
            await workoutRepo.delete(workoutId)
            notifyActiveWorkoutChanged()
            if (router.canGoBack()) router.back()
            else router.replace(originTabRoot)
            return true
        } catch (e) {
            log('error', 'Failed to delete workout', e)
            showToast.danger({ title: t('error'), message: t('failedToDeleteWorkout') })
            return false
        }
    }, [originTabRoot, t, workoutId, workoutRepo])

    const updateWorkoutTiming = useCallback(
        async (date: string, startTime: string, endTime?: string) => {
            try {
                await workoutRepo.updateTiming(workoutId, date, startTime, endTime)
                await loadData()
                return true
            } catch (e) {
                log('error', 'Failed to update workout timing', e)
                showToast.danger({ title: t('error'), message: t('failedToSaveWorkoutTime') })
                return false
            }
        },
        [loadData, t, workoutId, workoutRepo]
    )

    const saveAsTemplate = useCallback(
        async (name: string, exerciseUuids: string[]) => {
            try {
                await templateRepo.create({ name, exerciseUuids })
                return true
            } catch (e) {
                log('error', 'Failed to save workout as template', e)
                showToast.danger({ title: t('error'), message: t('failedToSaveTemplate') })
                return false
            }
        },
        [t, templateRepo]
    )

    // Every Exercise a block may show: the live ones plus deleted ones that
    // still have Sets here.
    const allExercises = useMemo(
        () => (deletedSetExercises.length > 0 ? [...exercises, ...deletedSetExercises] : exercises),
        [exercises, deletedSetExercises]
    )

    const templatePriority = useMemo(
        () => resolveTemplatePriority({ exercises, templateUuid: workout?.template_uuid, template }),
        [exercises, template, workout?.template_uuid]
    )

    return {
        workoutId,
        workout,
        sets,
        exercises: allExercises,
        liveExercises: exercises,
        templatePriority,
        loading,
        loadError,
        isSavingSet: savingSetCount > 0,
        loadData,
        addSet,
        saveSetOrder,
        updateSet,
        deleteSet,
        finishWorkout,
        deleteWorkout,
        updateWorkoutTiming,
        saveAsTemplate,
        getFinishedExerciseSets: workoutRepo.getFinishedExerciseSets,
    }
}
