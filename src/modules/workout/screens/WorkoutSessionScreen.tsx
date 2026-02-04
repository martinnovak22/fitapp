import { GlobalStyles } from '@/src/constants/Styles';

import { Exercise, ExerciseRepository } from '@/src/db/exercises';
import { SubSet, Workout, WorkoutRepository, Set as WorkoutSet } from '@/src/db/workouts';
import { Card } from '@/src/modules/core/components/Card';
import { EmptyState } from '@/src/modules/core/components/EmptyState';
import { ScreenHeader } from '@/src/modules/core/components/ScreenHeader';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { Typography } from '@/src/modules/core/components/Typography';
import { useSortableList } from '@/src/modules/core/hooks/useSortableList';
import { useTheme } from '@/src/modules/core/hooks/useTheme';
import { showToast } from '@/src/modules/core/utils/toast';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    FlatList,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { LogSetModal } from '../components/LogSetModal';

import { WorkoutSetItem } from '../components/WorkoutSetItem';

import { calculateSetHeight } from '../workoutUtils';

type SetWithExercise = WorkoutSet & { exercise_name: string };

export default function WorkoutSessionScreen() {
    const { t } = useTranslation();
    const { id } = useLocalSearchParams();
    const workoutId = Number(id);

    const [workout, setWorkout] = useState<Workout | null>(null);
    const [sets, setSets] = useState<SetWithExercise[]>([]);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSetId, setEditingSetId] = useState<number | null>(null);

    const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [subSets, setSubSets] = useState<SubSet[]>([]);
    const [inputValues, setInputValues] = useState({
        weight: '',
        reps: '',
        distance: '',
        durationMinutes: '',
        durationSeconds: '',
    });

    const loadData = useCallback(async () => {
        if (!workoutId) return;

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

        if (!selectedExerciseId && ex.length > 0) {
            const defaultEx = ex.find(e => e.name === 'Bench Press') || ex[0];
            setSelectedExerciseId(defaultEx.id);
        }
    }, [workoutId, selectedExerciseId]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const updateInput = (key: string, value: string) => {
        setInputValues(prev => ({ ...prev, [key]: value }));
    };

    const handleOpenAddModal = () => {
        setEditingSetId(null);
        setSubSets([]);
        setInputValues({
            weight: '',
            reps: '',
            distance: '',
            durationMinutes: '',
            durationSeconds: '',
        });
        setModalVisible(true);
    };

    const handleOpenEditModal = (s: WorkoutSet) => {
        setEditingSetId(s.id);
        setSelectedExerciseId(s.exercise_id);

        let mins = '';
        let secs = '';
        if (s.duration) {
            mins = Math.floor(s.duration).toString();
            secs = Math.round((s.duration - Math.floor(s.duration)) * 60).toString();
        }

        let parsedSubSets: SubSet[] = [];
        if (s.sub_sets) {
            try {
                parsedSubSets = JSON.parse(s.sub_sets);
            } catch (e) {
                console.error("Failed to parse sub_sets", e);
            }
        }
        setSubSets(parsedSubSets);

        setInputValues({
            weight: s.weight?.toString() || '',
            reps: s.reps?.toString() || '',
            distance: s.distance?.toString() || '',
            durationMinutes: mins,
            durationSeconds: secs,
        });
        setModalVisible(true);
    };

    const handleSaveSet = async () => {
        if (!selectedExerciseId) {
            showToast.error({
                title: t('selectExercise'),
                message: t('selectExerciseFirst')
            });
            return;
        }

        const selectedExercise = exercises.find(e => e.id === selectedExerciseId);
        if (!selectedExercise) return;

        const type = selectedExercise.type?.toLowerCase();
        const { weight, reps, distance, durationMinutes, durationSeconds } = inputValues;

        let finalDurationValue: number | null = null;
        const needsDuration = type === 'cardio' || type === 'bodyweight_timer';

        if (needsDuration) {
            const mins = parseFloat(durationMinutes || '0');
            const secs = parseFloat(durationSeconds || '0');
            if (!isNaN(mins) || !isNaN(secs)) {
                finalDurationValue = (isNaN(mins) ? 0 : mins) + (isNaN(secs) ? 0 : secs) / 60;
            }
        }

        const data: any = {};

        if (type !== 'cardio') {
            data.weight = weight ? parseFloat(weight) : null;
            if (weight && isNaN(data.weight)) data.weight = null;
        }

        if (type === 'weight' || type === 'bodyweight') {
            data.reps = reps ? parseInt(reps, 10) : null;
            if (reps && isNaN(data.reps)) data.reps = null;
        }

        if (type === 'cardio') {
            data.distance = distance ? parseFloat(distance) : null;
            if (distance && isNaN(data.distance)) data.distance = null;
        }

        if (needsDuration) {
            data.duration = finalDurationValue;
        }

        // Add sub_sets (pyramid sets)
        if (subSets.length > 0) {
            data.sub_sets = JSON.stringify(subSets);
        } else {
            data.sub_sets = null;
        }

        try {
            if (editingSetId) {
                await WorkoutRepository.updateSet(editingSetId, data);
            } else {
                await WorkoutRepository.addSet(workoutId, selectedExerciseId, data);
            }

            setModalVisible(false);
            setEditingSetId(null);
            setSubSets([]);
            await loadData();
            showToast.success({
                title: editingSetId ? t('update') : t('addSet'),
                message: editingSetId ? t('changesSaved') : t('newSetAdded')
            });
        } catch (e) {
            console.error("Failed to save set:", e);
            showToast.error({
                title: t('error'),
                message: t('failedToSaveSet')
            });
        }
    };

    const handleReorderSets = async (
        exerciseName: string,
        fromIndex: number,
        translationY: number,
        itemHeight: number,
        setSortable: any
    ) => {
        const exerciseSets = sets.filter(s => s.exercise_name === exerciseName);
        const heights = exerciseSets.map(s => calculateSetHeight(s.sub_sets));

        // Find current center Y of the dragged item
        let originalY = 0;
        for (let i = 0; i < fromIndex; i++) {
            originalY += heights[i];
        }
        const draggedCenterY = originalY + heights[fromIndex] / 2 + translationY;

        // Determine destination index by finding which height slot contains the dragged center
        let currentYBound = 0;
        let toIndex = 0;
        for (let i = 0; i < exerciseSets.length; i++) {
            const h = heights[i];
            if (draggedCenterY < currentYBound + h) {
                toIndex = i;
                break;
            }
            currentYBound += h;
            if (i === exerciseSets.length - 1) toIndex = i;
        }

        if (fromIndex === toIndex) {
            setSortable.activeIndex.value = -1;
            setSortable.translationY.value = 0;
            return;
        }

        const newExerciseSets = [...exerciseSets];
        const [movedSet] = newExerciseSets.splice(fromIndex, 1);
        newExerciseSets.splice(toIndex, 0, movedSet);

        const exerciseOrder = [...new Set(sets.map(s => s.exercise_name))];
        const allNewSets: SetWithExercise[] = [];
        let currentPos = 0;

        exerciseOrder.forEach(name => {
            const groupSets =
                name === exerciseName ? newExerciseSets : sets.filter(s => s.exercise_name === name);

            groupSets.forEach(s => {
                allNewSets.push({ ...s, position: currentPos++ });
            });
        });

        setSets(allNewSets);

        await Promise.all(allNewSets.map(s => WorkoutRepository.updateSetPosition(s.id, s.position)));

        setSortable.activeIndex.value = -1;
        setSortable.translationY.value = 0;
    };

    const handleFinishWorkout = async () => {
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

    const handleDeleteWorkout = () => {
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

    const handleDeleteSet = (setId: number) => {
        showToast.confirm({
            title: t('delete'),
            message: t('removeSetConfirm'),
            icon: 'trash',
            action: {
                label: t('delete'),
                onPress: async () => {
                    await WorkoutRepository.deleteSet(setId);
                    loadData();
                    showToast.success({ title: t('setDeleted'), message: t('setRemoved') });
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

    const isReadOnly = workout?.status === 'finished';

    return (
        <ScreenLayout>
            <ScreenHeader
                title={
                    isReadOnly
                        ? `${t('workout')} ${new Date(workout?.date || '').toLocaleDateString()}`
                        : t('activeSession')
                }
                onDelete={handleDeleteWorkout}
                rightAction={!isReadOnly ? { label: t('finish'), onPress: handleFinishWorkout } : undefined}
            />


            <FlatList
                data={exerciseNamesOrder}
                keyExtractor={name => name}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <EmptyState
                        message={isReadOnly ? t('noWorkoutsRecorded') : t('readyToCrush')}
                        icon={"file-text-o"}
                    />
                }

                renderItem={({ item: exerciseName }) => (
                    <WorkoutExerciseGroup
                        exerciseName={exerciseName}
                        sets={groupedSets[exerciseName]}
                        isReadOnly={isReadOnly}
                        draggingId={draggingId}
                        handleOpenEditModal={handleOpenEditModal}
                        handleDeleteSet={handleDeleteSet}
                        handleReorderSets={handleReorderSets}
                        setDraggingId={setDraggingId}
                    />
                )}
            />


            {!isReadOnly && (
                <TouchableOpacity style={GlobalStyles.fab} onPress={handleOpenAddModal}>
                    <FontAwesome name={"plus"} size={32} color={"white"} />
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
            />
        </ScreenLayout >
    );
}

interface GroupProps {
    exerciseName: string;
    sets: SetWithExercise[];
    isReadOnly: boolean;
    draggingId: number | null;
    handleOpenEditModal: (s: WorkoutSet) => void;
    handleDeleteSet: (id: number) => void;
    handleReorderSets: (name: string, idx: number, ty: number, height: number, sortable: any) => void;
    setDraggingId: (id: number | null) => void;
}

function WorkoutExerciseGroup({
    exerciseName,
    sets,
    isReadOnly,
    draggingId,
    handleOpenEditModal,
    handleDeleteSet,
    handleReorderSets,
    setDraggingId,
}: GroupProps) {
    const { theme } = useTheme();
    const setSortable = useSortableList();


    return (
        <Card style={[styles.groupCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.groupHeader, { borderBottomColor: theme.border }]}>
                <Typography.Subtitle>{exerciseName}</Typography.Subtitle>
            </View>


            <FlatList
                data={sets}
                keyExtractor={set => set.id.toString()}
                scrollEnabled={false}
                renderItem={({ item: set, index }) => (
                    <WorkoutSetItem
                        set={set}
                        index={index}
                        itemCount={sets.length}
                        isReadOnly={isReadOnly}
                        isDragging={set.id === draggingId}
                        onEdit={handleOpenEditModal}
                        onDelete={handleDeleteSet}
                        onDrop={(idx, ty, height) => {
                            handleReorderSets(exerciseName, idx, ty, height, setSortable);
                        }}
                        onDragStart={() => setDraggingId(set.id)}
                        onDragEnd={() => setDraggingId(null)}
                        activeIndex={setSortable.activeIndex}
                        translationY={setSortable.translationY}
                    />
                )}
            />
        </Card>
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingTop: 12,
        paddingBottom: 100,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
    },

    groupCard: {
        padding: 0,
        overflow: 'hidden',
        marginBottom: 16,
        borderWidth: 1,
    },
    groupHeader: {
        padding: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
});