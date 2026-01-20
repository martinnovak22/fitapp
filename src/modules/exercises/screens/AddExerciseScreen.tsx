import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { ExerciseRepository, ExerciseType } from '@/src/db/exercises';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

export default function AddExerciseScreen() {
    const { id } = useLocalSearchParams();
    const isEditing = !!id;

    const [name, setName] = useState('');
    const [muscle, setMuscle] = useState('');
    const [type, setType] = useState<ExerciseType>('weight');

    useEffect(() => {
        if (isEditing) {
            const load = async () => {
                const all = await ExerciseRepository.getAll();
                const found = all.find(e => e.id === Number(id));
                if (found) {
                    setName(found.name);
                    setMuscle(found.muscle_group || '');
                    setType(found.type);
                }
            };
            load();
        }
    }, [id]);

    const handleSave = async () => {
        if (!name) {
            Alert.alert('Required', 'Please enter an exercise name.');
            return;
        }

        try {
            if (isEditing) {
                await ExerciseRepository.update(Number(id), {
                    name,
                    muscle_group: muscle,
                    type
                });
            } else {
                await ExerciseRepository.create(name, type, muscle);
            }
            router.back();
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to save exercise.');
        }
    };

    return (
        <ScreenLayout>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
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
                                            {t.label}
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
                            <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                                <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Create Exercise'}</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ScreenLayout>
    );
}


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
        backgroundColor: Theme.tint,
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
        borderColor: Theme.border,
        alignItems: 'center',
    },
    typeButtonActive: {
        backgroundColor: Theme.tint,
        borderColor: Theme.tint,
    },
    typeButtonText: {
        color: Theme.textSecondary,
        fontWeight: '600',
        fontSize: 12,
    },
    typeButtonActiveText: {
        color: 'white',
    },
    subToggleContainer: {
        flexDirection: 'row',
        backgroundColor: Theme.background,
        borderRadius: 10,
        padding: 4,
        alignSelf: 'flex-start',
        width: '100%'
    },
    subToggleButton: {
        flex: 1,
        paddingVertical: 6,
        alignItems: 'center',
        borderRadius: 8,
    },
    subToggleButtonActive: {
        backgroundColor: Theme.surface,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
        elevation: 2,
    },
    subToggleText: {
        color: Theme.textSecondary,
        fontWeight: '600',
        fontSize: 12,
    },
    subToggleTextActive: {
        color: Theme.tint,
    }
});

