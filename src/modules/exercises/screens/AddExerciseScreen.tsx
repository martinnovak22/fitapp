import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { ExerciseRepository } from '@/src/db/exercises';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { router, Stack } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function AddExerciseScreen() {
    const [name, setName] = useState('');
    const [muscle, setMuscle] = useState('');
    const [type, setType] = useState('weight');

    const handleSave = async () => {
        if (!name) {
            Alert.alert('Required', 'Please enter an exercise name.');
            return;
        }

        try {
            await ExerciseRepository.create(name, type as any, muscle);
            router.back();
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to save exercise.');
        }
    };

    return (
        <ScreenLayout>
            <Stack.Screen options={{ title: 'New Exercise', headerBackTitle: 'Cancel' }} />
            <View style={GlobalStyles.card}>
                <Text style={GlobalStyles.subtitle}>Exercise Details</Text>

                <Text style={{ color: Theme.textSecondary, marginBottom: 8 }}>Name</Text>
                <TextInput
                    placeholder="e.g. Bench Press"
                    placeholderTextColor={Theme.textSecondary}
                    style={GlobalStyles.input}
                    value={name}
                    onChangeText={setName}
                    autoFocus
                />

                <Text style={{ color: Theme.textSecondary, marginBottom: 8 }}>Muscle Group</Text>
                <TextInput
                    placeholder="e.g. Chest"
                    placeholderTextColor={Theme.textSecondary}
                    style={GlobalStyles.input}
                    value={muscle}
                    onChangeText={setMuscle}
                />

                <Text style={{ color: Theme.textSecondary, marginTop: 16, marginBottom: 8 }}>Type</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {['weight', 'cardio', 'bodyweight'].map((t) => (
                        <TouchableOpacity
                            key={t}
                            style={[
                                styles.typeButton,
                                type === t && { backgroundColor: Theme.tint, borderColor: Theme.tint }
                            ]}
                            onPress={() => setType(t)}
                        >
                            <Text style={[
                                styles.typeButtonText,
                                type === t && { color: 'white' }
                            ]}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                    <Text style={styles.saveButtonText}>Create Exercise</Text>
                </TouchableOpacity>
            </View>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    saveButton: {
        backgroundColor: Theme.tint,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16,
    },
    saveButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Theme.textSecondary,
        alignItems: 'center',
    },
    typeButtonText: {
        color: Theme.textSecondary,
        fontWeight: '600',
    }
});
