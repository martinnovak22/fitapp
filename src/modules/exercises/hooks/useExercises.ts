import { getRepositories } from '@/src/data/repositories';
import { Exercise } from '@/src/db/exercises';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export function useExercises() {
    const { exercises: exerciseRepo } = getRepositories();
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const loadExercises = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await exerciseRepo.getAll();
            setExercises(data);
        } catch (error) {
            console.error('Failed to load exercises:', error);
        } finally {
            setIsLoading(false);
            setHasLoaded(true);
        }
    }, [exerciseRepo]);

    useFocusEffect(
        useCallback(() => {
            loadExercises();
        }, [loadExercises])
    );

    const handleReorder = async (newExercises: Exercise[]) => {
        const updated = newExercises.map((ex, idx) => ({ ...ex, position: idx }));
        setExercises(updated);

        try {
            await exerciseRepo.updatePositions(
                updated.map(ex => ({ id: ex.id, position: ex.position }))
            );
        } catch (error) {
            console.error('Failed to update positions:', error);
            loadExercises();
        }
    };

    return {
        exercises,
        isLoading,
        hasLoaded,
        loadExercises,
        handleReorder,
        setExercises,
    };
}
