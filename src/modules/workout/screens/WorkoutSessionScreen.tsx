import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { Exercise, ExerciseRepository } from '@/src/db/exercises';
import { Workout, WorkoutRepository, Set as WorkoutSet } from '@/src/db/workouts';
import { ScreenHeader } from '@/src/modules/core/components/ScreenHeader';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { formatDuration, formatExerciseType } from '@/src/utils/formatters';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

export default function WorkoutSessionScreen() {
    const { id } = useLocalSearchParams();
    const workoutId = Number(id);

    const [workout, setWorkout] = useState<Workout | null>(null);
    const [sets, setSets] = useState<(WorkoutSet & { exercise_name: string })[]>([]);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSetId, setEditingSetId] = useState<number | null>(null);

    const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
    const [inputValues, setInputValues] = useState({
        weight: '',
        reps: '',
        distance: '',
        durationMinutes: '',
        durationSeconds: ''
    });

    const loadData = useCallback(async () => {
        if (!workoutId) return;
        const w = await WorkoutRepository.getById(workoutId);
        setWorkout(w);

        const s = await WorkoutRepository.getSets(workoutId);
        setSets(s);

        const ex = await ExerciseRepository.getAll();
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

    const selectedExercise = exercises.find(e => e.id === selectedExerciseId);

    const updateInput = (key: keyof typeof inputValues, value: string) => {
        setInputValues(prev => ({ ...prev, [key]: value }));
    };

    const handleOpenAddModal = () => {
        setEditingSetId(null);
        setInputValues({ weight: '', reps: '', distance: '', durationMinutes: '', durationSeconds: '' });
        setModalVisible(true);
    };

    const handleOpenEditModal = (set: WorkoutSet) => {
        setEditingSetId(set.id);
        setSelectedExerciseId(set.exercise_id);

        let mins = '';
        let secs = '';
        if (set.duration) {
            mins = Math.floor(set.duration).toString();
            secs = Math.round((set.duration - Math.floor(set.duration)) * 60).toString();
        }

        setInputValues({
            weight: set.weight?.toString() || '',
            reps: set.reps?.toString() || '',
            distance: set.distance?.toString() || '',
            durationMinutes: mins,
            durationSeconds: secs
        });
        setModalVisible(true);
    };

    const handleSaveSet = async () => {
        if (!selectedExerciseId) {
            Alert.alert("Select Exercise", "Please select an exercise first.");
            return;
        }

        const { weight, reps, distance, durationMinutes, durationSeconds } = inputValues;

        let finalDuration = undefined;
        const needsDuration = selectedExercise?.type === 'cardio' || selectedExercise?.type === 'bodyweight_timer';

        if (needsDuration) {
            const mins = parseFloat(durationMinutes || '0');
            const secs = parseFloat(durationSeconds || '0');
            if (mins || secs) {
                finalDuration = mins + (secs / 60);
            }
        }

        const data: Partial<WorkoutSet> = {};

        // All types except cardio can have weight
        if (selectedExercise?.type !== 'cardio') {
            data.weight = weight ? parseFloat(weight) : undefined;
        }

        // Reps for standard weight and reps-based bodyweight
        if (selectedExercise?.type === 'weight' || selectedExercise?.type === 'bodyweight') {
            data.reps = reps ? parseInt(reps) : undefined;
        }

        if (selectedExercise?.type === 'cardio') {
            data.distance = distance ? parseFloat(distance) : undefined;
        }

        if (needsDuration) {
            data.duration = finalDuration;
        }

        if (editingSetId) {
            await WorkoutRepository.updateSet(editingSetId, data);
        } else {
            await WorkoutRepository.addSet(workoutId, selectedExerciseId, data);
        }

        setInputValues({ weight: '', reps: '', distance: '', durationMinutes: '', durationSeconds: '' });
        setModalVisible(false);
        setEditingSetId(null);
        loadData();
    };

    const handleFinishWorkout = async () => {
        Alert.alert(
            "Finish Workout",
            "Are you sure you want to finish this workout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Finish",
                    onPress: async () => {
                        await WorkoutRepository.finish(workoutId);
                        router.back();
                    }
                }
            ]
        );
    };

    const groupedSets = sets.reduce((acc, set: WorkoutSet & { exercise_name: string }) => {
        if (!acc[set.exercise_name]) acc[set.exercise_name] = [];
        acc[set.exercise_name].push(set);
        return acc;
    }, {} as Record<string, typeof sets>);

    const handleDeleteWorkout = () => {
        Alert.alert(
            "Delete Workout",
            "Are you sure you want to delete this workout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await WorkoutRepository.delete(workoutId);
                        router.back();
                    }
                }
            ]
        );
    };

    const isReadOnly = workout?.status === 'finished';

    const handleDeleteSet = (setId: number) => {
        Alert.alert(
            "Delete Set",
            "Are you sure you want to delete this set?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await WorkoutRepository.deleteSet(setId);
                        loadData();
                    }
                }
            ]
        );
    };

    const renderSetDetails = (set: WorkoutSet) => {
        const parts = [];
        if (set.weight) parts.push(`${set.weight}kg`);
        if (set.reps) parts.push(`${set.reps} reps`);
        if (set.distance) parts.push(`${set.distance}m`);
        if (set.duration) {
            parts.push(formatDuration(set.duration));
        }
        return parts.join(' x ') || 'No data';
    };

    return (
        <ScreenLayout>
            <ScreenHeader
                title={isReadOnly ? `Workout ${new Date(workout?.date || '').toLocaleDateString()}` : 'Workout Session'}
                onDelete={handleDeleteWorkout}
                rightAction={!isReadOnly ? {
                    label: "Finish",
                    onPress: handleFinishWorkout
                } : undefined}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
            >
                <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                    {Object.keys(groupedSets).length === 0 && (
                        <Text style={{ color: Theme.textSecondary, textAlign: 'center', marginTop: 40 }}>
                            {isReadOnly ? 'No sets logged for this workout.' : 'Tap + to add your first set.'}
                        </Text>
                    )}
                    {Object.entries(groupedSets).map(([exerciseName, exerciseSets]) => (
                        <View key={exerciseName} style={GlobalStyles.card}>
                            <Text style={[GlobalStyles.subtitle, { color: Theme.tint }]}>{exerciseName}</Text>
                            {exerciseSets.map((set, index) => (
                                <View key={set.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Theme.background }}>
                                    <TouchableOpacity
                                        onPress={() => !isReadOnly && handleOpenEditModal(set)}
                                        style={{ flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' }}
                                        disabled={isReadOnly}
                                    >
                                        <Text style={[GlobalStyles.text, { width: 40, opacity: 0.6 }]}>#{index + 1}</Text>
                                        <Text style={GlobalStyles.text}>{renderSetDetails(set)}</Text>
                                    </TouchableOpacity>

                                    {!isReadOnly && (
                                        <TouchableOpacity onPress={() => handleDeleteSet(set.id)} style={{ padding: 4 }}>
                                            <FontAwesome name="trash" size={16} color={Theme.error} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                        </View>
                    ))}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* FAB */}
            {!isReadOnly && (
                <TouchableOpacity
                    style={GlobalStyles.fab}
                    onPress={handleOpenAddModal}
                >
                    <FontAwesome name="plus" size={32} color={'white'} />
                </TouchableOpacity>
            )}

            {/* Log Set Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <Animated.View
                        style={styles.modalView}
                    >
                        <Text style={GlobalStyles.title}>{editingSetId ? 'Edit Set' : 'Log Set'}</Text>

                        {!editingSetId && (
                            <>
                                <Text style={GlobalStyles.subtitle}>Exercise</Text>
                                <ScrollView style={styles.exerciseList}>
                                    {exercises.map(ex => (
                                        <TouchableOpacity
                                            key={ex.id}
                                            style={[
                                                styles.exerciseItem,
                                                selectedExerciseId === ex.id && styles.exerciseItemActive
                                            ]}
                                            onPress={() => {
                                                setSelectedExerciseId(ex.id);
                                                setInputValues({ weight: '', reps: '', distance: '', durationMinutes: '', durationSeconds: '' });
                                            }}
                                        >
                                            <Text style={[
                                                styles.exerciseItemText,
                                                selectedExerciseId === ex.id && styles.exerciseItemActiveText
                                            ]}>{ex.name}</Text>
                                            <Text style={[
                                                styles.exerciseItemSubtext,
                                                selectedExerciseId === ex.id && styles.exerciseItemActiveSubtext
                                            ]}>{formatExerciseType(ex.type)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </>
                        )}

                        <Animated.View
                            layout={LinearTransition.duration(800)}
                            style={[styles.dynamicFields, { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }]}
                        >
                            {selectedExercise?.type !== 'cardio' && (
                                <Animated.View
                                    entering={FadeIn.duration(800)}
                                    style={{ flex: 1, minWidth: selectedExercise?.type === 'bodyweight_timer' ? '100%' : '45%' }}
                                >
                                    <Text style={GlobalStyles.subtitle}>Weight (kg)</Text>
                                    <TextInput
                                        keyboardType='numeric'
                                        style={GlobalStyles.input}
                                        value={inputValues.weight}
                                        onChangeText={(t) => updateInput('weight', t)}
                                        placeholder="0"
                                        placeholderTextColor={Theme.textSecondary}
                                    />
                                </Animated.View>
                            )}
                            {(selectedExercise?.type === 'weight' || selectedExercise?.type === 'bodyweight') && (
                                <Animated.View
                                    entering={FadeIn.duration(800)}
                                    style={{ flex: 1, minWidth: '45%' }}
                                >
                                    <Text style={GlobalStyles.subtitle}>Reps</Text>
                                    <TextInput
                                        keyboardType='numeric'
                                        style={GlobalStyles.input}
                                        value={inputValues.reps}
                                        onChangeText={(t) => updateInput('reps', t)}
                                        placeholder="0"
                                        placeholderTextColor={Theme.textSecondary}
                                    />
                                </Animated.View>
                            )}
                            {selectedExercise?.type === 'cardio' && (
                                <Animated.View
                                    entering={FadeIn.duration(800)}
                                    style={{ flex: 1, minWidth: '30%' }}
                                >
                                    <Text style={GlobalStyles.subtitle}>Dist (m)</Text>
                                    <TextInput
                                        keyboardType='numeric'
                                        style={GlobalStyles.input}
                                        value={inputValues.distance}
                                        onChangeText={(t) => updateInput('distance', t)}
                                        placeholder="0"
                                        placeholderTextColor={Theme.textSecondary}
                                    />
                                </Animated.View>
                            )}
                            {(selectedExercise?.type === 'cardio' || selectedExercise?.type === 'bodyweight_timer') && (
                                <Animated.View
                                    entering={FadeIn.duration(800)}
                                    style={{ flex: 2, flexDirection: 'row', gap: 10, minWidth: selectedExercise?.type === 'cardio' ? '65%' : '100%' }}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={GlobalStyles.subtitle}>Min</Text>
                                        <TextInput
                                            keyboardType='numeric'
                                            style={GlobalStyles.input}
                                            value={inputValues.durationMinutes}
                                            onChangeText={(t) => updateInput('durationMinutes', t)}
                                            placeholder="00"
                                            placeholderTextColor={Theme.textSecondary}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={GlobalStyles.subtitle}>Sec</Text>
                                        <TextInput
                                            keyboardType='numeric'
                                            style={GlobalStyles.input}
                                            value={inputValues.durationSeconds}
                                            onChangeText={(t) => updateInput('durationSeconds', t)}
                                            placeholder="00"
                                            placeholderTextColor={Theme.textSecondary}
                                        />
                                    </View>
                                </Animated.View>
                            )}
                        </Animated.View>

                        <Animated.View layout={LinearTransition} style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 24 }}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 10, marginRight: 10 }}>
                                <Text style={{ color: Theme.error }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSaveSet} style={{ padding: 10, backgroundColor: Theme.tint, borderRadius: 8, paddingHorizontal: 20 }}>
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>{editingSetId ? 'Update' : 'Add Set'}</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </Animated.View>
                </View>
            </Modal>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)'
    },
    modalView: {
        width: '90%',
        backgroundColor: Theme.surface,
        borderRadius: 20,
        padding: 24,
        elevation: 5
    },
    exerciseList: {
        maxHeight: 150,
        marginBottom: 18,
        backgroundColor: Theme.background,
        borderRadius: 8,
    },
    exerciseItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: Theme.border + '20',
    },
    exerciseItemActive: {
        backgroundColor: Theme.tint,
    },
    exerciseItemText: {
        color: Theme.text,
        fontWeight: '600',
    },
    exerciseItemActiveText: {
        color: 'white',
    },
    exerciseItemSubtext: {
        color: Theme.textSecondary,
        fontSize: 8,
        marginTop: 2,
    },
    exerciseItemActiveSubtext: {
        color: 'rgba(255,255,255,0.7)',
    },
    dynamicFields: {
        flexDirection: 'column',
    }
});
