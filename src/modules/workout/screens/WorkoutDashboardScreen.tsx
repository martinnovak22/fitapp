import { Theme } from '@/src/constants/Colors';
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
    const [stats, setStats] = useState({
        sessions: 0,
        avgDuration: 0,
    });

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

        // Load stats
        const thisMonthStr = today.toISOString().slice(0, 7);
        const sessions = await WorkoutRepository.getWorkoutCountForMonth(thisMonthStr);
        const avgDuration = await WorkoutRepository.getAvgWorkoutDuration(thisMonthStr);

        setStats({
            sessions,
            avgDuration: Math.round(avgDuration),
        });
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
            <ScrollView refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                />
            }
            >
                <Card
                    onPress={() => router.push('/workout/calendar')}
                    style={styles.heroCard}
                >
                    <View style={styles.heroStatsRow}>
                        <View style={styles.heroStatItem}>
                            <Typography.Meta style={styles.statLabel}>SESSIONS</Typography.Meta>
                            <Typography.Subtitle style={styles.statValue}>🗓️ {stats.sessions}</Typography.Subtitle>
                            <Typography.Meta style={styles.statSublabel}>Completed</Typography.Meta>
                        </View>
                        <View style={styles.heroStatSeparator} />
                        <View style={styles.heroStatItem}>
                            <Typography.Meta style={styles.statLabel}>AVG TIME</Typography.Meta>
                            <Typography.Subtitle style={styles.statValue}>⏱️ {stats.avgDuration}m</Typography.Subtitle>
                            <Typography.Meta style={styles.statSublabel}>Per session</Typography.Meta>
                        </View>
                    </View>

                    <View style={styles.heroDivider} />

                    <View style={styles.headerRow}>
                        <Typography.Subtitle style={styles.sectionTitle}>Weekly Activity</Typography.Subtitle>
                        <FontAwesome name="chevron-right" size={12} color={Theme.textSecondary} />
                    </View>

                    <View style={styles.weekRow}>
                        {consistency.map(day => (
                            <View key={day.date} style={styles.dayCol}>
                                <View
                                    style={[
                                        styles.dayBox,
                                        day.workedOut && styles.dayBoxDone
                                    ]}
                                >
                                    {day.workedOut && (
                                        <FontAwesome name="check" size={10} color="white" />
                                    )}
                                </View>
                                <Typography.Meta style={[styles.dayLabel, day.workedOut && styles.dayLabelDone]}>
                                    {day.day}
                                </Typography.Meta>
                            </View>
                        ))}
                    </View>
                </Card>

                <Card style={styles.activeCard}>
                    <View style={styles.activeHeader}>
                        <Typography.Subtitle style={[styles.sectionTitle, { marginBottom: 0 }]}>
                            {activeWorkout ? 'Active Session' : 'Workout'}
                        </Typography.Subtitle>
                        {activeWorkout && (
                            <View style={styles.liveIndicator}>
                                <View style={styles.liveDot} />
                                <Typography.Meta style={styles.liveText}>LIVE</Typography.Meta>
                            </View>
                        )}
                    </View>

                    {activeWorkout ? (
                        <View style={styles.activeContent}>
                            <Typography.Body style={styles.activeTime}>
                                Started at{' '}
                                {new Date(activeWorkout.start_time).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </Typography.Body>

                            <Button
                                label="Resume Session"
                                onPress={handleStartWorkout}
                            />
                        </View>
                    ) : (
                        <View style={styles.activeContent}>
                            <Typography.Body style={styles.activePromo}>
                                Ready to crush your goals today?
                            </Typography.Body>
                            <Button
                                label="Start New Workout"
                                onPress={handleStartWorkout}
                            />
                        </View>
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
    heroCard: {
        marginBottom: 20,
        paddingVertical: 20
    },
    heroStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        marginBottom: 20,
    },
    heroStatItem: {
        alignItems: 'center',
        flex: 1,
    },
    heroStatSeparator: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    heroDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Theme.text,
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: Theme.textSecondary,
        letterSpacing: 1,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    statSublabel: {
        fontSize: 10,
        color: Theme.textSecondary,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    weekRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: 4,
    },
    dayCol: {
        alignItems: 'center',
        flex: 1,
    },
    dayBox: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginBottom: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    dayBoxDone: {
        backgroundColor: Theme.primary,
        borderColor: Theme.primary,
    },
    dayLabel: {
        fontSize: 11,
        color: Theme.textSecondary,
    },
    dayLabelDone: {
        color: Theme.text,
        fontWeight: 'bold',
    },
    activeCard: {
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: Theme.primary,
        padding: 20,
    },
    activeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(81, 160, 111, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Theme.primary,
        marginRight: 6,
    },
    liveText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: Theme.primary,
        letterSpacing: 0.5,
    },
    activeContent: {
        marginTop: 4,
    },
    activeTime: {
        marginBottom: 16,
        color: Theme.textSecondary,
    },
    activePromo: {
        marginBottom: 16,
        color: Theme.textSecondary,
        fontSize: 15,
    },
    recentContainer: {
        rowGap: 12,
    },
    recentCard: {
        padding: 16,
        marginBottom: 0,
    },
    recentTitle: {
        fontWeight: '600',
        fontSize: 15,
        color: Theme.text,
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
        color: Theme.textSecondary,
        fontSize: 12,
        marginTop: 4,
    },
});