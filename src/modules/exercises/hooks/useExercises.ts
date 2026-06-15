import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useExerciseRepo } from '@/src/data/RepositoryContext'
import { useReloadOnSyncSuccess } from '@/src/data/sync/useReloadOnSyncSuccess'
import type { Exercise } from '@/src/db/exercises'
import { log } from '@/src/modules/core/utils/logger'
import { useStaleGuard } from '@/src/modules/core/hooks/useStaleGuard'

export function useExercises() {
    const exerciseRepo = useExerciseRepo()
    const { t } = useTranslation()
    const [exercises, setExercises] = useState<Exercise[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isReordering, setIsReordering] = useState(false)
    const [hasLoaded, setHasLoaded] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)

    const beginLoad = useStaleGuard()

    const loadExercises = useCallback(async () => {
        // Focus, the post-sync reload, and reorder-failure recovery can race;
        // only the most recent run may commit, or a stale read taken while
        // sync was still writing would overwrite the fresh list.
        const isStale = beginLoad()
        setIsLoading(true)
        setLoadError(null)
        try {
            const data = await exerciseRepo.getAll()
            if (!isStale()) setExercises(data)
        } catch (error) {
            log('error', 'Failed to load exercises', error)
            if (!isStale()) setLoadError(t('failedToLoadExercises'))
        } finally {
            if (!isStale()) {
                setIsLoading(false)
                setHasLoaded(true)
            }
        }
    }, [beginLoad, exerciseRepo, t])

    useFocusEffect(
        useCallback(() => {
            loadExercises()
        }, [loadExercises])
    )

    // Reflect rows a background sync just pulled (e.g. right after login)
    // without making the user pull to refresh.
    useReloadOnSyncSuccess(loadExercises)

    const handleReorder = async (newExercises: Exercise[]) => {
        const updated = newExercises.map((ex, idx) => ({ ...ex, position: idx }))
        setExercises(updated)
        setIsReordering(true)

        try {
            await exerciseRepo.updatePositions(updated.map((ex) => ({ id: ex.id, position: ex.position })))
        } catch (error) {
            log('error', 'Failed to update positions', error)
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
