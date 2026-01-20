import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { Exercise, ExerciseRepository } from '@/src/db/exercises';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { formatExerciseType } from '@/src/utils/formatters';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ExercisesListScreen() {
    const [exercises, setExercises] = useState<Exercise[]>([]);

    const loadExercises = async () => {
        // Seed defaults first time if empty
        await ExerciseRepository.seedDefaults();
        const data = await ExerciseRepository.getAll();
        setExercises(data);
    };

    useFocusEffect(
        useCallback(() => {
            loadExercises();
        }, [])
    );

    const renderItem = ({ item }: { item: Exercise }) => (
        <TouchableOpacity onPress={() => router.push(`/(tabs)/exercises/${item.id}`)}>
            <View style={GlobalStyles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                        <Text style={[GlobalStyles.text, { fontWeight: 'bold', fontSize: 18, marginBottom: 4 }]}>{item.name}</Text>
                        <Text style={[GlobalStyles.subtitle, { fontSize: 13, opacity: 0.8 }]}>
                            {item.muscle_group ? `${item.muscle_group} • ` : ''}{formatExerciseType(item.type)}
                        </Text>
                    </View>
                    <FontAwesome name="chevron-right" size={14} color={Theme.textSecondary} />
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <ScreenLayout>
            <FlatList
                data={exercises}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={{ paddingBottom: 80 }}
            />

            <TouchableOpacity
                style={GlobalStyles.fab}
                onPress={() => router.push('/(tabs)/exercises/add')}
            >
                <FontAwesome name="plus" size={32} color={'white'} />
            </TouchableOpacity>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({});
