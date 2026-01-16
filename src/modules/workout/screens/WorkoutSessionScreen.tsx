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

    // Add Set Form
    const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');

    const loadData = useCallback(async () => {
        if (!workoutId) return;
        const w = await WorkoutRepository.getById(workoutId);
        setWorkout(w);

        const s = await WorkoutRepository.getSets(workoutId);
        setSets(s);

        // Load exercises for the picker
        const ex = await ExerciseRepository.getAll();
        setExercises(ex);
    }, [workoutId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleAddSet = async () => {
        if (!selectedExerciseId || !weight || !reps) {
            Alert.alert("Complete all fields", "Please select an exercise and enter weight/reps");
            return;
        }
        await WorkoutRepository.addSet(workoutId, selectedExerciseId, parseFloat(weight), parseInt(reps));
        setWeight('');
        setReps('');
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
                            <View key={set.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Theme.background }}>
                                <Text style={GlobalStyles.text}>Set {index + 1}</Text>
                                <Text style={GlobalStyles.text}>{set.weight}kg x {set.reps}</Text>
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
                        <ScrollView style={{ maxHeight: 150, marginBottom: 12, backgroundColor: Theme.background, borderRadius: 8 }}>
                            {exercises.map(ex => (
                                <TouchableOpacity
                                    key={ex.id}
                                    style={{ padding: 12, backgroundColor: selectedExerciseId === ex.id ? Theme.tint : 'transparent' }}
                                    onPress={() => setSelectedExerciseId(ex.id)}
                                >
                                    <Text style={{ color: selectedExerciseId === ex.id ? 'white' : Theme.text }}>{ex.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={GlobalStyles.subtitle}>Weight (kg)</Text>
                                <TextInput
                                    keyboardType='numeric'
                                    style={GlobalStyles.input}
                                    value={weight}
                                    onChangeText={setWeight}
                                    placeholder="0"
                                    placeholderTextColor={Theme.textSecondary}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={GlobalStyles.subtitle}>Reps</Text>
                                <TextInput
                                    keyboardType='numeric'
                                    style={GlobalStyles.input}
                                    value={reps}
                                    onChangeText={setReps}
                                    placeholder="0"
                                    placeholderTextColor={Theme.textSecondary}
                                />
                            </View>
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
