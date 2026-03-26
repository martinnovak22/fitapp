import { getRepositories } from '@/src/data/repositories'
import { Exercise } from '@/src/db/exercises'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function useExercises() {
    const { exercises: exerciseRepo } = getRepositories()
    const { t } = useTranslation()
    const [exercises, setExercises] = useState<Exercise[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isReordering, setIsReordering] = useState(false)
    const [hasLoaded, setHasLoaded] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)

    const loadExercises = useCallback(async () => {
        setIsLoading(true)
        setLoadError(null)
        try {
            const data = await exerciseRepo.getAll()
            setExercises(data)
        } catch (error) {
            console.error('Failed to load exercises:', error)
            setLoadError(t('failedToLoadExercises'))
        } finally {
            setIsLoading(false)
            setHasLoaded(true)
        }
    }, [exerciseRepo, t])

    useFocusEffect(
        useCallback(() => {
            loadExercises()
        }, [loadExercises])
    )

    const handleReorder = async (newExercises: Exercise[]) => {
        const updated = newExercises.map((ex, idx) => ({ ...ex, position: idx }))
        setExercises(updated)
        setIsReordering(true)

        try {
            await exerciseRepo.updatePositions(updated.map((ex) => ({ id: ex.id, position: ex.position })))
        } catch (error) {
            console.error('Failed to update positions:', error)
            setLoadError(t('failedToReorderExercises'))
            loadExercises()
        } finally {
            setIsReordering(false)
        }
    }

    return {
        exercises,
        isLoading,
        isReordering,
        hasLoaded,
        loadError,
        loadExercises,
        handleReorder,
        setExercises,
    }
}
