import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { ExerciseRepository, ExerciseType } from '@/src/db/exercises';
import { ScreenHeader } from '@/src/modules/core/components/ScreenHeader';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

export default function AddExerciseScreen() {
    const { id } = useLocalSearchParams();
    const isEditing = !!id;

    const [name, setName] = useState('');
    const [muscle, setMuscle] = useState('');
    const [type, setType] = useState<ExerciseType>('weight');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isEditing) {
            loadExercise();
        }
    }, [id]);

    const loadExercise = async () => {
        const exercise = await ExerciseRepository.getById(Number(id));
        if (exercise) {
            setName(exercise.name);
            setMuscle(exercise.muscle_group || '');
            setType(exercise.type);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Required', 'Please enter an exercise name.');
            return;
        }

        setIsLoading(true);
        try {
            if (isEditing) {
                await ExerciseRepository.update(Number(id), {
                    name: name.trim(),
                    muscle_group: muscle.trim().toLowerCase() || undefined,
                    type: type.toLowerCase() as ExerciseType
                });
            } else {
                await ExerciseRepository.create(
                    name.trim(),
                    type.toLowerCase() as ExerciseType,
                    muscle.trim().toLowerCase() || undefined
                );
            }
            router.back();
        } catch (error) {
            console.error('Failed to save exercise:', error);
            Alert.alert('Error', 'Failed to save exercise.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Exercise',
            'Are you sure? This will not delete past workout data but will remove it from the list.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await ExerciseRepository.delete(Number(id));
                        router.dismissAll();
                        router.replace('/(tabs)/exercises');
                    }
                }
            ]
        );
    };

    return (
        <ScreenLayout>
            <ScreenHeader
                title={isEditing ? 'Edit Exercise' : 'Add Exercise'}
                onDelete={isEditing ? handleDelete : undefined}
            />
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <Animated.View layout={LinearTransition.duration(300)} style={GlobalStyles.card}>
                    <Text style={GlobalStyles.subtitle}>Exercise Details</Text>

                    <Text style={styles.label}>Name</Text>
                    <TextInput
                        placeholder="e.g. Bench Press"
                        placeholderTextColor={Theme.textSecondary}
                        style={GlobalStyles.input}
                        value={name}
                        onChangeText={setName}
                        autoFocus={!isEditing}
                    />

                    <Text style={styles.label}>Muscle Group</Text>
                    <TextInput
                        placeholder="e.g. Chest"
                        placeholderTextColor={Theme.textSecondary}
                        style={GlobalStyles.input}
                        value={muscle}
                        onChangeText={setMuscle}
                    />

                    <Text style={[GlobalStyles.subtitle, { marginTop: 16 }]}>Exercise Type</Text>
                    <Animated.View layout={LinearTransition.duration(300)} style={styles.typeContainer}>
                        {[
                            { label: 'Weight', value: 'weight' as ExerciseType },
                            { label: 'Cardio', value: 'cardio' as ExerciseType },
                            { label: 'Bodyweight', value: 'bodyweight' as ExerciseType },
                        ].map((t) => {
                            const isActive = type === t.value || (t.value === 'bodyweight' && type === 'bodyweight_timer');
                            return (
                                <TouchableOpacity
                                    key={t.value}
                                    style={[
                                        styles.typeButton,
                                        isActive && styles.typeButtonActive
                                    ]}
                                    onPress={() => setType(t.value)}
                                >
                                    <Text style={[
                                        styles.typeButtonText,
                                        isActive && styles.typeButtonActiveText
                                    ]}>
                                        {formatExerciseTypeCapitalized(t.label)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </Animated.View>

                    {(type === 'bodyweight' || type === 'bodyweight_timer') && (
                        <Animated.View
                            entering={FadeIn}
                            exiting={FadeOut}
                            layout={LinearTransition}
                            style={{ marginTop: 20 }}
                        >
                            <Text style={styles.labelCompact}>Tracking Mode</Text>
                            <View style={styles.subToggleContainer}>
                                <TouchableOpacity
                                    style={[
                                        styles.subToggleButton,
                                        type === 'bodyweight' && styles.subToggleButtonActive
                                    ]}
                                    onPress={() => setType('bodyweight')}
                                >
                                    <Text style={[
                                        styles.subToggleText,
                                        type === 'bodyweight' && styles.subToggleTextActive
                                    ]}>Reps</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.subToggleButton,
                                        type === 'bodyweight_timer' && styles.subToggleButtonActive
                                    ]}
                                    onPress={() => setType('bodyweight_timer')}
                                >
                                    <Text style={[
                                        styles.subToggleText,
                                        type === 'bodyweight_timer' && styles.subToggleTextActive
                                    ]}>Timer</Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    )}

                    <Animated.View layout={LinearTransition.duration(300)}>
                        <TouchableOpacity
                            onPress={handleSave}
                            style={[styles.saveButton, isLoading && { opacity: 0.7 }]}
                            disabled={isLoading}
                        >
                            <Text style={styles.saveButtonText}>
                                {isLoading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Exercise')}
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </Animated.View>
            </ScrollView>
        </ScreenLayout>
    );
}

// Simple helper since we are inside the file and don't want to over-import
const formatExerciseTypeCapitalized = (val: string) => val;

const styles = StyleSheet.create({
    label: {
        color: Theme.textSecondary,
        marginBottom: 8,
        fontSize: 14,
        fontWeight: '500',
    },
    labelCompact: {
        color: Theme.textSecondary,
        marginBottom: 6,
        fontSize: 12,
        fontWeight: '500',
    },
    typeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    saveButton: {
        backgroundColor: Theme.primary,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 24,
    },
    saveButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    typeButton: {
        flex: 1,
        minWidth: '30%',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    typeButtonActive: {
        backgroundColor: Theme.primary,
        borderColor: Theme.primary,
    },
    typeButtonText: {
        fontSize: 12,
        color: Theme.textSecondary,
        fontWeight: '500',
    },
    typeButtonActiveText: {
        color: 'white',
    },
    subToggleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        padding: 4,
    },
    subToggleButton: {
        flex: 1,
        paddingVertical: 5,
        alignItems: 'center',
        borderRadius: 6,
    },
    subToggleButtonActive: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    subToggleText: {
        color: Theme.textSecondary,
        fontSize: 12,
        fontWeight: '500',
    },
    subToggleTextActive: {
        color: Theme.text,
        fontWeight: 'bold',
    },
});
