import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { Workout, WorkoutRepository } from '@/src/db/workouts';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';

export default function HistoryScreen() {
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        const data = await WorkoutRepository.getAllWorkouts();
        setWorkouts(data);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const renderItem = ({ item }: { item: Workout }) => (
        <TouchableOpacity onPress={() => router.push(`/(tabs)/history/${item.id}`)}>
            <View style={GlobalStyles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <Text style={[GlobalStyles.text, { fontWeight: 'bold' }]}>
                            {new Date(item.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </Text>
                        <Text style={{ color: Theme.textSecondary, marginTop: 4 }}>
                            {item.start_time ? new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            {item.end_time ? ` - ${new Date(item.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (In Progress)'}
                        </Text>
                        {item.note && <Text style={{ color: Theme.textSecondary, fontStyle: 'italic', marginTop: 4 }}>"{item.note}"</Text>}
                    </View>
                    <FontAwesome
                        name={item.status === 'finished' ? "check-circle" : "clock-o"}
                        size={24}
                        color={item.status === 'finished' ? Theme.secondary : Theme.tint}
                    />
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <ScreenLayout>
            <FlatList
                data={workouts}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={{ paddingBottom: 20 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.tint} />}
                ListEmptyComponent={<Text style={{ color: Theme.textSecondary, textAlign: 'center', marginTop: 50 }}>No workouts logged yet.</Text>}
            />
        </ScreenLayout>
    );
}
