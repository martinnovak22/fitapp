import { Exercise, ExerciseRepository } from '@/src/db/exercises';
import { Workout, WorkoutRepository, Set as WorkoutSet } from '@/src/db/workouts';
import { showToast } from '@/src/modules/core/utils/toast';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

type SetWithExercise = WorkoutSet & { exercise_name: string };

export function useWorkoutSession() {
    const { t } = useTranslation();
    const { id } = useLocalSearchParams();
    const workoutId = Number(id);

    const [workout, setWorkout] = useState<Workout | null>(null);
    const [sets, setSets] = useState<SetWithExercise[]>([]);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        if (!workoutId) return;
        setLoading(true);

        try {
            const [w, s, ex] = await Promise.all([
                WorkoutRepository.getById(workoutId),
                WorkoutRepository.getSets(workoutId),
                ExerciseRepository.getAll(),
            ]);

            if (!w) {
                router.replace('/(tabs)/workout');
                return;
            }

            setWorkout(w);
            setSets(s as SetWithExercise[]);
            setExercises(ex);
        } catch (e) {
            console.error("Failed to load workout session:", e);
        } finally {
            setLoading(false);
        }
    }, [workoutId]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const addSet = async (exerciseId: number, data: any) => {
        try {
            await WorkoutRepository.addSet(workoutId, exerciseId, data);
            await loadData();
            showToast.success({ title: t('addSet'), message: t('newSetAdded') });
            return true;
        } catch (e) {
            console.error("Failed to add set:", e);
            showToast.danger({ title: t('error'), message: t('failedToSaveSet') });
            return false;
        }
    };

    const updateSet = async (setId: number, data: any) => {
        try {
            await WorkoutRepository.updateSet(setId, data);
            await loadData();
            showToast.success({ title: t('update'), message: t('changesSaved') });
            return true;
        } catch (e) {
            console.error("Failed to update set:", e);
            showToast.danger({ title: t('error'), message: t('failedToSaveSet') });
            return false;
        }
    };

    const deleteSet = (setId: number) => {
        showToast.confirm({
            title: t('delete'),
            message: t('removeSetConfirm'),
            icon: 'trash',
            action: {
                label: t('delete'),
                onPress: async () => {
                    await WorkoutRepository.deleteSet(setId);
                    await loadData();
                    showToast.success({ title: t('setDeleted'), message: t('setRemoved') });
                },
            },
        });
    };

    const finishWorkout = () => {
        showToast.confirm({
            title: t('finishWorkout'),
            message: t('finishSessionConfirm'),
            action: {
                label: t('finish'),
                onPress: async () => {
                    await WorkoutRepository.finish(workoutId);
                    router.replace('/(tabs)/history');
                    showToast.success({ title: t('workoutFinished'), message: t('greatJob') });
                },
            },
        });
    };

    const deleteWorkout = () => {
        showToast.confirm({
            title: t('delete'),
            message: t('deleteWorkoutConfirm'),
            icon: 'trash',
            action: {
                label: t('delete'),
                onPress: async () => {
                    await WorkoutRepository.delete(workoutId);
                    router.replace('/(tabs)/workout');
                    showToast.success({ title: t('workoutDeleted'), message: t('workoutRemoved') });
                },
            },
        });
    };

    const exerciseNamesOrder = [...new Set(sets.map(s => s.exercise_name))];
    const groupedSets = sets.reduce((acc, set) => {
        if (!acc[set.exercise_name]) acc[set.exercise_name] = [];
        acc[set.exercise_name].push(set);
        return acc;
    }, {} as Record<string, SetWithExercise[]>);

    const reorderSets = useCallback(async (exerciseName: string, newGroupSets: SetWithExercise[]) => {
        setSets(prevSets => {
            const currentGrouped = { ...groupedSets };
            currentGrouped[exerciseName] = newGroupSets;

            const allNewSets: SetWithExercise[] = [];
            let currentPos = 0;

            exerciseNamesOrder.forEach(name => {
                const group = currentGrouped[name] || [];
                group.forEach(s => {
                    allNewSets.push({ ...s, position: currentPos++ });
                });
            });

            const setsToUpdate = allNewSets.filter(s => s.exercise_name === exerciseName);
            Promise.all(setsToUpdate.map(s => WorkoutRepository.updateSetPosition(s.id, s.position)))
                .catch(e => console.error("Failed to update positions", e));

            return allNewSets;
        });
    }, [groupedSets, exerciseNamesOrder]);

    return {
        workout,
        sets,
        exercises,
        loading,
        exerciseNamesOrder,
        groupedSets,
        loadData,
        addSet,
        updateSet,
        deleteSet,
        finishWorkout,
        deleteWorkout,
        reorderSets,
    };
}
