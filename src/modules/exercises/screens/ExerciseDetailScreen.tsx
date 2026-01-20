import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { Exercise, ExerciseRepository } from '@/src/db/exercises';
import { WorkoutRepository } from '@/src/db/workouts';
import { ScreenHeader } from '@/src/modules/core/components/ScreenHeader';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { formatExerciseType } from '@/src/utils/formatters';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ExerciseHistoryGraph } from './components/ExerciseHistoryGraph';


export default function ExerciseDetailScreen() {
    const { id } = useLocalSearchParams();
    const [exercise, setExercise] = useState<Exercise | null>(null);
    const [historyData, setHistoryData] = useState<any[]>([]);

    useEffect(() => {
        const load = async () => {
            if (id) {
                const all = await ExerciseRepository.getAll();
                const found = all.find(e => e.id === Number(id));
                setExercise(found || null);

                if (found) {
                    const data = await WorkoutRepository.getExerciseHistory(found.id);
                    setHistoryData(data);
                }
            }
        };
        load();
    }, [id]);



    if (!exercise) {
        return (
            <ScreenLayout>
                <Text style={GlobalStyles.text}>Loading...</Text>
            </ScreenLayout>
        );
    }

    const handleDelete = () => {
        Alert.alert(
            "Delete Exercise",
            "Are you sure? This will delete all history for this exercise.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        if (exercise) {
                            await ExerciseRepository.delete(exercise.id);
                            router.back();
                        }
                    }
                }
            ]
        );
    };

    return (
        <ScreenLayout>
            <ScreenHeader
                title={exercise.name}
                onDelete={handleDelete}
                rightAction={{
                    label: "Edit",
                    onPress: () => router.push(`/(tabs)/exercises/add?id=${exercise.id}`)
                }}
            />

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={GlobalStyles.card}>
                    <View style={{ marginBottom: 16 }}>
                        <Text style={[GlobalStyles.subtitle, { color: Theme.textSecondary }]}>Type</Text>
                        <Text style={GlobalStyles.text}>{formatExerciseType(exercise.type)}</Text>
                    </View>

                    <View style={{ marginBottom: 16 }}>
                        <Text style={[GlobalStyles.subtitle, { color: Theme.textSecondary }]}>Muscle Group</Text>
                        <Text style={GlobalStyles.text}>{exercise.muscle_group || 'Not specified'}</Text>
                    </View>

                    {historyData.length > 0 ? (
                        <ExerciseHistoryGraph
                            exercise={exercise}
                            data={historyData}
                        />
                    ) : (
                        <View style={{ marginTop: 20, padding: 20, backgroundColor: Theme.surface, borderRadius: 8, alignItems: 'center' }}>
                            <FontAwesome name="line-chart" size={40} color={Theme.textSecondary} />
                            <Text style={{ color: Theme.textSecondary, marginTop: 10 }}>Stats coming soon</Text>
                        </View>
                    )}
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({});
