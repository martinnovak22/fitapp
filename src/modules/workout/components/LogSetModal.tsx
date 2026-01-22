import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { Exercise } from '@/src/db/exercises';
import { formatExerciseType } from '@/src/utils/formatters';
import React from 'react';
import { Keyboard, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

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

const ExercisePicker = ({
    exercises,
    selectedExerciseId,
    setSelectedExerciseId,
    updateInput
}: Pick<Props, 'exercises' | 'selectedExerciseId' | 'setSelectedExerciseId' | 'updateInput'>) => (
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
                        ['weight', 'reps', 'distance', 'durationMinutes', 'durationSeconds'].forEach(key => updateInput(key, ''));
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
);

const SetInputFields = ({
    selectedExercise,
    inputValues,
    updateInput
}: {
    selectedExercise?: Exercise;
    inputValues: Props['inputValues'];
    updateInput: Props['updateInput']
}) => {
    const type = selectedExercise?.type?.toLowerCase();

    return (
        <Animated.View
            layout={LinearTransition}
            style={[styles.dynamicFields, { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }]}
        >
            {type !== 'cardio' && (
                <View style={{ flex: 1, minWidth: type === 'bodyweight_timer' ? '100%' : '45%' }}>
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
            )}

            {(type === 'weight' || type === 'bodyweight') && (
                <View style={{ flex: 1, minWidth: '45%' }}>
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
            )}

            {type === 'cardio' && (
                <View style={{ flex: 1, minWidth: '30%' }}>
                    <Text style={GlobalStyles.subtitle}>Dist (m)</Text>
                    <TextInput
                        keyboardType='numeric'
                        style={GlobalStyles.input}
                        value={inputValues.distance}
                        onChangeText={(t) => updateInput('distance', t)}
                        placeholder="0"
                        placeholderTextColor={Theme.textSecondary}
                    />
                </View>
            )}

            {(type === 'cardio' || type === 'bodyweight_timer') && (
                <Animated.View
                    layout={LinearTransition}
                    entering={FadeIn}
                    style={{ flex: 2, flexDirection: 'row', gap: 10, minWidth: type === 'cardio' ? '65%' : '100%' }}
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
    );
};

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
    const keyboardHeight = useSharedValue(0);

    React.useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                keyboardHeight.value = withTiming(e.endCoordinates.height, { duration: 250 });
            }
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            (e) => {
                keyboardHeight.value = withTiming(0, { duration: 250 });
            }
        );

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        console.log(keyboardHeight.value)
        return {
            transform: [{ translateY: -keyboardHeight.value / 2 }],
        };
    });

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <Animated.View style={[styles.modalView, animatedStyle]}>
                    <Text style={GlobalStyles.title}>{editingSetId ? 'Edit Set' : 'Input Set'}</Text>

                    {!editingSetId && (
                        <ExercisePicker
                            exercises={exercises}
                            selectedExerciseId={selectedExerciseId}
                            setSelectedExerciseId={setSelectedExerciseId}
                            updateInput={updateInput}
                        />
                    )}

                    <SetInputFields
                        selectedExercise={selectedExercise}
                        inputValues={inputValues}
                        updateInput={updateInput}
                    />

                    <View style={styles.footer}>
                        <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onSave} style={styles.saveButton}>
                            <Text style={styles.saveText}>{editingSetId ? 'Update' : 'Add Set'}</Text>
                        </TouchableOpacity>
                    </View>
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
        backgroundColor: Theme.primary,
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
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 24,
        gap: 10,
    },
    cancelButton: {
        padding: 10,
        marginRight: 10,
    },
    cancelText: {
        color: Theme.error,
    },
    saveButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: Theme.primary,
        borderRadius: 8,
    },
    saveText: {
        color: 'white',
        fontWeight: 'bold',
    }
});
