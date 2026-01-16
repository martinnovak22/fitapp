import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { Workout, WorkoutRepository } from '@/src/db/workouts';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WorkoutDashboardScreen() {
    const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
    const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const [consistency, setConsistency] = useState<{ date: string, day: string, workedOut: boolean }[]>([]);

    const loadData = async () => {
        const active = await WorkoutRepository.getActiveWorkout();
        setActiveWorkout(active);
        const recent = await WorkoutRepository.getRecentWorkouts();
        setRecentWorkouts(recent);

        const today = new Date();
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            last7Days.push(d.toISOString().split('T')[0]);
        }

        const periodWorkouts = await WorkoutRepository.getWorkoutsForPeriod(last7Days[0], last7Days[6]);
        const periodMap = new Set(periodWorkouts.map(w => w.date));

        const consData = last7Days.map(dateStr => {
            const d = new Date(dateStr);
            return {
                date: dateStr,
                day: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
                workedOut: periodMap.has(dateStr)
            };
        });
        setConsistency(consData);
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

    const handleStartWorkout = async () => {
        if (activeWorkout) {
            router.push(`/(tabs)/workout/${activeWorkout.id}`);
        } else {
            const today = new Date().toISOString().split('T')[0];
            const id = await WorkoutRepository.create(today);
            router.push(`/(tabs)/workout/${id}`);
        }
    };

    return (
        <ScreenLayout>
            <ScrollView
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.tint} />}
            >
                <View style={[GlobalStyles.card, { marginBottom: 16 }]}>
                    <Text style={[GlobalStyles.subtitle, { marginBottom: 12 }]}>This Week</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        {consistency.map((day, index) => (
                            <View key={day.date} style={{ alignItems: 'center' }}>
                                <Text style={{ color: Theme.textSecondary, marginBottom: 4, fontSize: 12 }}>{day.day}</Text>
                                <View style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    backgroundColor: day.workedOut ? Theme.tint : '#333',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}>
                                    {day.workedOut && <FontAwesome name="check" size={12} color="white" />}
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={GlobalStyles.card}>
                    <Text style={GlobalStyles.subtitle}>
                        {activeWorkout ? 'Active Session' : 'Ready to train?'}
                    </Text>
                    {activeWorkout ? (
                        <View>
                            <Text style={{ color: Theme.textSecondary, marginBottom: 12 }}>
                                Started at {new Date(activeWorkout.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            <TouchableOpacity style={styles.button} onPress={handleStartWorkout}>
                                <Text style={styles.buttonText}>Resume Workout</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.button} onPress={handleStartWorkout}>
                            <Text style={styles.buttonText}>Start Workout</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={[GlobalStyles.subtitle, { marginTop: 24 }]}>Recent Activity</Text>
                {recentWorkouts.length === 0 ? (
                    <Text style={{ color: Theme.textSecondary }}>No recent workouts.</Text>
                ) : (
                    recentWorkouts.map(workout => (
                        <TouchableOpacity key={workout.id} onPress={() => router.push(`/(tabs)/history/${workout.id}`)}>
                            <View style={[GlobalStyles.card, { marginBottom: 8 }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View>
                                        <Text style={GlobalStyles.text}>{new Date(workout.date).toDateString()}</Text>
                                        <Text style={{ color: Theme.textSecondary, fontSize: 12 }}>
                                            {workout.end_time ?
                                                `${new Date(workout.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(workout.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                : 'Incomplete'}
                                        </Text>
                                    </View>
                                    <FontAwesome name="check-circle" size={20} color={Theme.secondary} />
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: Theme.tint,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    }
});
