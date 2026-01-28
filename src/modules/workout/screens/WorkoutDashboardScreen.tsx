import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { Workout, WorkoutRepository } from '@/src/db/workouts';
import { Button } from '@/src/modules/core/components/Button';
import { Card } from '@/src/modules/core/components/Card';
import { EmptyState } from '@/src/modules/core/components/EmptyState';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { Typography } from '@/src/modules/core/components/Typography';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
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
                <Card
                    onPress={() => router.push('/workout/calendar')}
                    style={styles.sectionCard}
                >
                    <View style={styles.headerRow}>
                        <Typography.Subtitle>This Week</Typography.Subtitle>
                        <FontAwesome name="chevron-right" size={14} color={Theme.primary} />
                    </View>

                    <View style={styles.weekRow}>
                        {consistency.map(day => (
                            <View key={day.date} style={styles.dayCol}>
                                <Typography.Meta style={styles.dayLabel}>{day.day}</Typography.Meta>

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
                </Card>

                <Card>
                    <Typography.Subtitle style={activeWorkout ? { marginBottom: 0 } : { marginBottom: 8 }}>
                        {activeWorkout ? 'Active Session' : 'Ready to train?'}
                    </Typography.Subtitle>

                    {activeWorkout ? (
                        <View>
                            <Typography.Meta style={styles.activeMeta}>
                                Started at{' '}
                                {new Date(activeWorkout.start_time).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </Typography.Meta>

                            <Button
                                label="Resume Workout"
                                onPress={handleStartWorkout}
                            />
                        </View>
                    ) : (
                        <Button
                            label="Start Workout"
                            onPress={handleStartWorkout}
                        />
                    )}
                </Card>

                <Card>
                    <Typography.Subtitle style={{ marginBottom: 12 }}>Recent Activity</Typography.Subtitle>
                    <View style={styles.recentContainer}>
                        {allWorkouts.length === 0 ? (
                            <EmptyState message={"No workouts recorded"} icon={"history"} />
                        ) : (
                            allWorkouts.map(workout => (

                                <Card
                                    key={workout.id}
                                    onPress={() => router.push(`/(tabs)/history/${workout.id}`)}
                                    style={styles.recentCard}
                                >
                                    <View style={styles.recentRow}>
                                        <View style={styles.recentLeft}>
                                            <Typography.Body style={styles.recentTitle}>
                                                {new Date(workout.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).charAt(0).toUpperCase() + new Date(workout.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).slice(1)}
                                            </Typography.Body>

                                            <Typography.Meta style={styles.recentMeta}>
                                                {workout.end_time
                                                    ? `${new Date(workout.start_time).toLocaleTimeString([],
                                                        { hour: '2-digit', minute: '2-digit' }
                                                    )} - ${new Date(workout.end_time).toLocaleTimeString([],
                                                        { hour: '2-digit', minute: '2-digit' }
                                                    )}`
                                                    : 'Incomplete'}
                                            </Typography.Meta>
                                        </View>

                                        <FontAwesome
                                            name={workout.status === 'finished' ? "check-circle" : "clock-o"}
                                            size={24}
                                            color={workout.status === 'finished' ? Theme.primary : Theme.secondary}
                                        />
                                    </View>
                                </Card>

                            ))
                        )}
                    </View>
                </Card>
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
        marginBottom: 4,
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
        marginBottom: 12,
    },
    recentContainer: {
        rowGap: 12,
    },
    recentCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginBottom: 0,
    },
    recentTitle: {
        fontWeight: 'bold',
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