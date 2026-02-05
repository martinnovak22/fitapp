import { Exercise, ExerciseRepository } from '@/src/db/exercises';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export function useExercises() {
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadExercises = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await ExerciseRepository.getAll();
            setExercises(data);
        } catch (error) {
            console.error('Failed to load exercises:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadExercises();
        }, [loadExercises])
    );

    const handleReorder = async (newExercises: Exercise[]) => {
        const updated = newExercises.map((ex, idx) => ({ ...ex, position: idx }));
        setExercises(updated);

        try {
            await ExerciseRepository.updatePositions(
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
        loadExercises,
        handleReorder,
        setExercises,
    };
}
