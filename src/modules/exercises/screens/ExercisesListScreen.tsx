import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { Exercise, ExerciseRepository } from '@/src/db/exercises';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
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
                    <View>
                        <Text style={[GlobalStyles.text, { fontWeight: 'bold', fontSize: 18 }]}>{item.name}</Text>
                        <Text style={[GlobalStyles.subtitle, { fontSize: 14 }]}>{item.muscle_group} • {item.type}</Text>
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
                style={styles.fab}
                onPress={() => router.push('/(tabs)/exercises/add')}
            >
                <FontAwesome name="plus" size={24} color={'white'} />
            </TouchableOpacity>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        backgroundColor: Theme.tint,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: 'black',
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 2 }
    }
});
