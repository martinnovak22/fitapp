import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { Exercise } from '@/src/db/exercises';
import { formatExerciseType } from '@/src/utils/formatters';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSave: () => void;
    editingSetId: number | null;
    exercises: Exercise[];
    selectedExerciseId: number | null;
    setSelectedExerciseId: (id: number) => void;
    inputValues: {
        weight: string;
        reps: string;
        distance: string;
        durationMinutes: string;
        durationSeconds: string;
    };
    updateInput: (key: string, value: string) => void;
}

export const LogSetModal = ({
    visible,
    onClose,
    onSave,
    editingSetId,
    exercises,
    selectedExerciseId,
    setSelectedExerciseId,
    inputValues,
    updateInput
}: Props) => {
    const selectedExercise = exercises.find(e => e.id === selectedExerciseId);

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <Animated.View layout={LinearTransition} style={styles.modalView}>
                    <Text style={GlobalStyles.title}>{editingSetId ? 'Edit Set' : 'Log Set'}</Text>

                    {!editingSetId && (
                        <Animated.View layout={LinearTransition}>
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
                                            updateInput('weight', '');
                                            updateInput('reps', '');
                                            updateInput('distance', '');
                                            updateInput('durationMinutes', '');
                                            updateInput('durationSeconds', '');
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
                        </Animated.View>
                    )}

                    <Animated.View
                        layout={LinearTransition}
                        style={[styles.dynamicFields, { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }]}
                    >
                        {selectedExercise?.type?.toLowerCase() !== 'cardio' && (
                            <Animated.View
                                layout={LinearTransition}
                                style={{ flex: 1, minWidth: selectedExercise?.type?.toLowerCase() === 'bodyweight_timer' ? '100%' : '45%' }}
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
                        {(selectedExercise?.type?.toLowerCase() === 'weight' || selectedExercise?.type?.toLowerCase() === 'bodyweight') && (
                            <Animated.View
                                layout={LinearTransition}
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
                        {selectedExercise?.type?.toLowerCase() === 'cardio' && (
                            <Animated.View
                                layout={LinearTransition}
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
                        {(selectedExercise?.type?.toLowerCase() === 'cardio' || selectedExercise?.type?.toLowerCase() === 'bodyweight_timer') && (
                            <Animated.View
                                layout={LinearTransition}
                                style={{ flex: 2, flexDirection: 'row', gap: 10, minWidth: selectedExercise?.type?.toLowerCase() === 'cardio' ? '65%' : '100%' }}
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
                        <TouchableOpacity onPress={onClose} style={{ padding: 10, marginRight: 10 }}>
                            <Text style={{ color: Theme.error }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onSave} style={{ padding: 10, backgroundColor: Theme.tint, borderRadius: 8, paddingHorizontal: 20 }}>
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>{editingSetId ? 'Update' : 'Add Set'}</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </Animated.View>
            </View>
        </Modal>
    );
};

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
