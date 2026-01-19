import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { Exercise, ExerciseRepository } from '@/src/db/exercises';
import { Workout, WorkoutRepository, Set as WorkoutSet } from '@/src/db/workouts';
import { ScreenHeader } from '@/src/modules/core/components/ScreenHeader';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function WorkoutSessionScreen() {
    const { id } = useLocalSearchParams();
    const workoutId = Number(id);

    const [workout, setWorkout] = useState<Workout | null>(null);
    const [sets, setSets] = useState<(WorkoutSet & { exercise_name: string })[]>([]);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [modalVisible, setModalVisible] = useState(false);

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

    useEffect(() => {
        loadData();
    }, [loadData]);

    const selectedExercise = exercises.find(e => e.id === selectedExerciseId);

    const updateInput = (key: keyof typeof inputValues, value: string) => {
        setInputValues(prev => ({ ...prev, [key]: value }));
    };

    const handleAddSet = async () => {
        if (!selectedExerciseId) {
            Alert.alert("Select Exercise", "Please select an exercise first.");
            return;
        }

        const type = selectedExercise?.type || 'weight';
        const { weight, reps, distance, durationMinutes, durationSeconds } = inputValues;

        if (type === 'weight' && (!weight || !reps)) {
            Alert.alert("Invalid Input", "Please enter weight and reps.");
            return;
        }

        let finalDuration = undefined;
        if (type === 'cardio') {
            if (!distance || (!durationMinutes && !durationSeconds)) {
                Alert.alert("Invalid Input", "Please enter distance and duration.");
                return;
            }
            const mins = parseFloat(durationMinutes || '0');
            const secs = parseFloat(durationSeconds || '0');
            finalDuration = mins + (secs / 60);
        }

        if (type === 'bodyweight' && !reps) {
            Alert.alert("Invalid Input", "Please enter reps.");
            return;
        }

        await WorkoutRepository.addSet(workoutId, selectedExerciseId, {
            weight: weight ? parseFloat(weight) : undefined,
            reps: reps ? parseInt(reps) : undefined,
            distance: distance ? parseFloat(distance) : undefined,
            duration: finalDuration,
        });

        setInputValues({ weight: '', reps: '', distance: '', durationMinutes: '', durationSeconds: '' });
        setModalVisible(false);
        loadData();
    };

    const handleFinishWorkout = async () => {
        Alert.alert(
            "Finish Workout",
            "Are you sure you represent completely finished?",
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
        if (set.distance && set.duration) {
            const mins = Math.floor(set.duration);
            const secs = Math.round((set.duration - mins) * 60);
            return `${set.distance}km in ${mins}m ${secs}s`;
        }
        if (set.weight) {
            return `${set.weight}kg x ${set.reps} reps`;
        }
        return `${set.reps} reps`;
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
                            <View key={set.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Theme.background }}>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <Text style={[GlobalStyles.text, { width: 40 }]}>Set {index + 1}</Text>
                                    <Text style={GlobalStyles.text}>{renderSetDetails(set)}</Text>
                                </View>
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

            {/* FAB */}
            {!isReadOnly && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => setModalVisible(true)}
                >
                    <FontAwesome name="plus" size={32} color={'white'} />
                </TouchableOpacity>
            )}

            {/* Add Set Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Text style={GlobalStyles.title}>Log Set</Text>

                        <Text style={GlobalStyles.subtitle}>Exercise</Text>
                        <ScrollView style={{ maxHeight: 150, marginBottom: 18, backgroundColor: Theme.background, borderRadius: 8 }}>
                            {exercises.map(ex => (
                                <TouchableOpacity
                                    key={ex.id}
                                    style={{ padding: 12, backgroundColor: selectedExerciseId === ex.id ? Theme.tint : 'transparent' }}
                                    onPress={() => {
                                        setSelectedExerciseId(ex.id);
                                        setInputValues({ weight: '', reps: '', distance: '', durationMinutes: '', durationSeconds: '' });
                                    }}
                                >
                                    <Text style={{ color: selectedExerciseId === ex.id ? 'white' : Theme.text }}>{ex.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={{ flexDirection: 'column', gap: 10 }}>
                            {/* Weight Exercise Inputs */}
                            {(selectedExercise?.type === 'weight' || !selectedExercise) && (
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={GlobalStyles.subtitle}>Weight (kg)</Text>
                                        <TextInput
                                            keyboardType='numeric'
                                            style={GlobalStyles.input}
                                            value={inputValues.weight}
                                            onChangeText={(t) => updateInput('weight', t)}
                                            placeholder="0"
                                            placeholderTextColor={Theme.textSecondary}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={GlobalStyles.subtitle}>Reps</Text>
                                        <TextInput
                                            keyboardType='numeric'
                                            style={GlobalStyles.input}
                                            value={inputValues.reps}
                                            onChangeText={(t) => updateInput('reps', t)}
                                            placeholder="0"
                                            placeholderTextColor={Theme.textSecondary}
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Bodyweight Exercise Inputs */}
                            {selectedExercise?.type === 'bodyweight' && (
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={GlobalStyles.subtitle}>Reps</Text>
                                        <TextInput
                                            keyboardType='numeric'
                                            style={GlobalStyles.input}
                                            value={inputValues.reps}
                                            onChangeText={(t) => updateInput('reps', t)}
                                            placeholder="0"
                                            placeholderTextColor={Theme.textSecondary}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[GlobalStyles.subtitle, { color: Theme.textSecondary, fontSize: 10, flex: 1, textAlignVertical: 'center' }]}>Extra Weight (Optional)</Text>
                                        <TextInput
                                            keyboardType='numeric'
                                            style={[GlobalStyles.input, { backgroundColor: '#f0f0f01a' }]}
                                            value={inputValues.weight}
                                            onChangeText={(t) => updateInput('weight', t)}
                                            placeholder="+ kg"
                                            placeholderTextColor={Theme.textSecondary}
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Cardio Exercise Inputs */}
                            {selectedExercise?.type === 'cardio' && (
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={GlobalStyles.subtitle}>Distance (km)</Text>
                                        <TextInput
                                            keyboardType='numeric'
                                            style={GlobalStyles.input}
                                            value={inputValues.distance}
                                            onChangeText={(t) => updateInput('distance', t)}
                                            placeholder="0.0"
                                            placeholderTextColor={Theme.textSecondary}
                                        />
                                    </View>
                                    <View style={{ flex: 1, flexDirection: 'row', gap: 5 }}>
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
                                    </View>
                                </View>
                            )}
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 10, marginRight: 10 }}>
                                <Text style={{ color: Theme.error }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleAddSet} style={{ padding: 10, backgroundColor: Theme.tint, borderRadius: 8 }}>
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Add Set</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 30,
        backgroundColor: Theme.tint,
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
    },
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
    }
});
