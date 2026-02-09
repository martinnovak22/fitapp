import { GlobalStyles } from '@/src/constants/Styles';
import { SubSet, Set as WorkoutSet } from '@/src/db/workouts';
import { Card } from '@/src/modules/core/components/Card';
import { EmptyState } from '@/src/modules/core/components/EmptyState';
import { ScreenHeader } from '@/src/modules/core/components/ScreenHeader';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { Typography } from '@/src/modules/core/components/Typography';
import { useTheme } from '@/src/modules/core/hooks/useTheme';
import { showToast } from '@/src/modules/core/utils/toast';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { NestedReorderableList, ScrollViewContainer, reorderItems } from 'react-native-reorderable-list';
import { LogSetModal } from '../components/LogSetModal';
import { WorkoutSetItem } from '../components/WorkoutSetItem';
import { useWorkoutSession } from '../hooks/useWorkoutSession';

type SetWithExercise = WorkoutSet & { exercise_name: string };

export default function WorkoutSessionScreen() {
    const { t } = useTranslation();
    const {
        workout,
        exercises,
        exerciseNamesOrder,
        groupedSets,
        finishWorkout,
        deleteWorkout,
        deleteSet,
        reorderSets,
        addSet,
        updateSet
    } = useWorkoutSession();

    const [modalVisible, setModalVisible] = useState(false);
    const [editingSetId, setEditingSetId] = useState<number | null>(null);

    const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
    const [subSets, setSubSets] = useState<SubSet[]>([]);
    const [inputValues, setInputValues] = useState({
        weight: '',
        reps: '',
        distance: '',
        durationMinutes: '',
        durationSeconds: '',
    });

    // We can allow default selection once exercises are loaded
    useEffect(() => {
        if (!selectedExerciseId && exercises.length > 0) {
            const defaultEx = exercises.find(e => e.name === 'Bench Press') || exercises[0];
            setSelectedExerciseId(defaultEx.id);
        }
    }, [exercises, selectedExerciseId]);

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
            showToast.danger({ title: t('selectExercise'), message: t('selectExerciseFirst') });
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
            data.reps = parseInt(reps || '0');
            if (reps && isNaN(data.reps)) data.reps = null;
        }
        if (type === 'cardio') {
            data.distance = distance ? parseFloat(distance) : null;
            if (distance && isNaN(data.distance)) data.distance = null;
        }
        if (needsDuration) data.duration = finalDurationValue;

        // Filter out empty sub-sets (0/0)
        const filteredSubSets = subSets.filter(ss => (ss.weight || 0) > 0 || (ss.reps || 0) > 0);

        data.sub_sets = filteredSubSets.length > 0 ? JSON.stringify(filteredSubSets) : null;

        // Final validation: check if the overall set has ANY non-zero/non-null data
        const hasMainData = (data.weight && data.weight > 0) ||
            (data.reps && data.reps > 0) ||
            (data.distance && data.distance > 0) ||
            (data.duration && data.duration > 0);

        const hasSubSets = filteredSubSets.length > 0;

        if (!hasMainData && !hasSubSets) {
            showToast.info({
                title: t('emptySetIgnored'),
                message: t('emptySetIgnoredMessage')
            });
            setModalVisible(false);
            return;
        }

        let success = false;
        if (editingSetId) {
            success = await updateSet(editingSetId, data);
        } else {
            success = await addSet(selectedExerciseId, data);
        }

        if (success) {
            setModalVisible(false);
            setEditingSetId(null);
            setSubSets([]);
        }
    };

    const isReadOnly = workout?.status === 'finished';

    return (
        <ScreenLayout>
            <ScreenHeader
                title={
                    isReadOnly
                        ? `${t('workout')} ${new Date(workout?.date || '').toLocaleDateString()}`
                        : t('activeSession')
                }
                onDelete={deleteWorkout}
                rightAction={!isReadOnly ? { label: t('finish'), onPress: finishWorkout } : undefined}
            />

            <ScrollViewContainer
                style={{ flex: 1 }}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps={"handled"}
                showsVerticalScrollIndicator={false}
            >
                {exerciseNamesOrder.length === 0 ? (
                    <EmptyState
                        message={isReadOnly ? t('noWorkoutsRecorded') : t('readyToCrush')}
                        icon={"file-text-o"}
                    />
                ) : (
                    exerciseNamesOrder.map((exerciseName) => (
                        <WorkoutExerciseGroup
                            key={exerciseName}
                            exerciseName={exerciseName}
                            sets={groupedSets[exerciseName]}
                            isReadOnly={isReadOnly}
                            handleOpenEditModal={handleOpenEditModal}
                            handleDeleteSet={deleteSet}
                            handleReorderSets={reorderSets}
                        />
                    ))
                )}
            </ScrollViewContainer>

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
        </ScreenLayout>
    );
}

interface GroupProps {
    exerciseName: string;
    sets: SetWithExercise[];
    isReadOnly: boolean;
    handleOpenEditModal: (s: WorkoutSet) => void;
    handleDeleteSet: (id: number) => void;
    handleReorderSets: (exerciseName: string, newSets: SetWithExercise[]) => void;
}

function WorkoutExerciseGroup({
    exerciseName,
    sets,
    isReadOnly,
    handleOpenEditModal,
    handleDeleteSet,
    handleReorderSets,
}: GroupProps) {
    const { theme } = useTheme();

    const renderItem = useCallback(({ item, index }: any) => {
        return (
            <WorkoutSetItem
                set={item}
                index={index}
                isReadOnly={isReadOnly}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteSet}
            />
        );
    }, [isReadOnly, handleOpenEditModal, handleDeleteSet]);

    return (
        <Card style={[styles.groupCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.groupHeader, { borderBottomColor: theme.border }]}>
                <Typography.Subtitle>{exerciseName}</Typography.Subtitle>
            </View>

            <NestedReorderableList
                data={sets}
                onReorder={({ from, to }) => {
                    const newData = reorderItems(sets, from, to);
                    handleReorderSets(exerciseName, newData);
                }}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
                renderItem={renderItem}
                shouldUpdateActiveItem
                panGesture={Gesture.Pan().activateAfterLongPress(250)}
            />
        </Card>
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingTop: 12,
        paddingBottom: 100,
    },
    groupCard: {
        padding: 0,
        marginBottom: 16,
    },
    groupHeader: {
        padding: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
});