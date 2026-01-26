import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { Workout, WorkoutRepository } from '@/src/db/workouts';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function WorkoutDashboardScreen() {
    const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
    const [allWorkouts, setAllWorkouts] = useState<Workout[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [consistency, setConsistency] = useState<
        { date: string; day: string; workedOut: boolean }[]
    >([]);

    const loadData = async () => {
        const active = await WorkoutRepository.getActiveWorkout();
        setActiveWorkout(active);

        const all = await WorkoutRepository.getAllWorkouts();
        setAllWorkouts(all);

        const today = new Date();
        const last7Days: string[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            last7Days.push(d.toISOString().split('T')[0]);
        }

        const periodWorkouts = await WorkoutRepository.getWorkoutsForPeriod(
            last7Days[0],
            last7Days[6]
        );
        const periodMap = new Set(periodWorkouts.map(w => w.date));

        const consData = last7Days.map(dateStr => {
            const d = new Date(dateStr);
            return {
                date: dateStr,
                day: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
                workedOut: periodMap.has(dateStr),
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
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const id = await WorkoutRepository.create(today);
        router.push(`/(tabs)/workout/${id}`);
    };

    return (
        <ScreenLayout>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                    />
                }
            >
                <TouchableOpacity
                    style={[GlobalStyles.card, styles.sectionCard]}
                    onPress={() => router.push('/workout/calendar')}
                    activeOpacity={0.7}
                >
                    <View style={styles.headerRow}>
                        <Text style={styles.sectionTitle}>This Week</Text>
                        <FontAwesome name="chevron-right" size={14} color={Theme.primary} />
                    </View>

                    <View style={styles.weekRow}>
                        {consistency.map(day => (
                            <View key={day.date} style={styles.dayCol}>
                                <Text style={styles.dayLabel}>{day.day}</Text>

                                <View
                                    style={[
                                        styles.dayCircle,
                                        day.workedOut ? styles.dayCircleDone : styles.dayCircleTodo,
                                    ]}
                                >
                                    {day.workedOut && (
                                        <FontAwesome name={'check'} size={12} color={'white'} />
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                </TouchableOpacity>

                <View style={GlobalStyles.card}>
                    <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>
                        {activeWorkout ? 'Active Session' : 'Ready to train?'}
                    </Text>

                    {activeWorkout ? (
                        <View>
                            <Text style={styles.activeMeta}>
                                Started at{' '}
                                {new Date(activeWorkout.start_time).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </Text>

                            <TouchableOpacity style={styles.primaryButton} onPress={handleStartWorkout}>
                                <Text style={styles.primaryButtonText}>Resume Workout</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.primaryButton} onPress={handleStartWorkout}>
                            <Text style={styles.primaryButtonText}>Start Workout</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={GlobalStyles.card}>

                    <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Recent Activity</Text>

                    {allWorkouts.length === 0 ? (
                        <View style={styles.noWorkoutContainer}>
                            <Text style={styles.noWorkoutText}>No workouts recorded</Text>
                        </View>
                    ) : (
                        allWorkouts.map(workout => (
                            <TouchableOpacity
                                key={workout.id}
                                onPress={() => router.push(`/(tabs)/history/${workout.id}`)}
                            >
                                <View style={[GlobalStyles.card]}>
                                    <View style={styles.recentRow}>
                                        <View style={styles.recentLeft}>
                                            <Text style={[GlobalStyles.text, { fontWeight: 'bold' }]}>
                                                {new Date(workout.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).charAt(0).toUpperCase() + new Date(workout.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).slice(1)}
                                            </Text>

                                            <Text style={styles.recentMeta}>
                                                {workout.end_time
                                                    ? `${new Date(workout.start_time).toLocaleTimeString([],
                                                        { hour: '2-digit', minute: '2-digit' }
                                                    )} - ${new Date(workout.end_time).toLocaleTimeString([],
                                                        { hour: '2-digit', minute: '2-digit' }
                                                    )}`
                                                    : 'Incomplete'}
                                            </Text>
                                        </View>

                                        <FontAwesome
                                            name={workout.status === 'finished' ? "check-circle" : "clock-o"}
                                            size={24}
                                            color={workout.status === 'finished' ? Theme.primary : Theme.secondary}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            </ScrollView>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingBottom: 40,
    },

    sectionCard: {
        marginBottom: 16,
    },
    sectionTitle: {
        ...GlobalStyles.subtitle,
        color: Theme.text,
        marginBottom: 0,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },

    weekRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayCol: {
        alignItems: 'center',
    },
    dayLabel: {
        ...GlobalStyles.text,
        color: Theme.textSecondary,
        marginBottom: 4,
        fontSize: 12,
    },
    dayCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    dayCircleDone: {
        backgroundColor: Theme.primary,
        borderColor: Theme.primary,
    },
    dayCircleTodo: {
        backgroundColor: Theme.surface,
        borderColor: 'rgba(255,255,255,0.08)',
    },

    activeMeta: {
        ...GlobalStyles.text,
        color: Theme.textSecondary,
        marginBottom: 12,
        fontSize: 12,
    },

    primaryButton: {
        backgroundColor: Theme.primary,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    primaryButtonText: {
        ...GlobalStyles.text,
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },

    mutedText: {
        ...GlobalStyles.text,
        color: Theme.textSecondary,
    },
    noWorkoutContainer: {
        padding: 40,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    noWorkoutText: {
        ...GlobalStyles.text,
        color: Theme.textSecondary,
    },
    recentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    recentLeft: {
        flex: 1,
        paddingRight: 12,
    },
    recentMeta: {
        ...GlobalStyles.text,
        color: Theme.textSecondary,
        fontSize: 12,
    },
});