import { Workout, WorkoutRepository } from '@/src/db/workouts';
import { Button } from '@/src/modules/core/components/Button';
import { Card } from '@/src/modules/core/components/Card';
import { EmptyState } from '@/src/modules/core/components/EmptyState';
import { ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { Typography } from '@/src/modules/core/components/Typography';
import { useTheme } from '@/src/modules/core/hooks/useTheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    RefreshControl,
    StyleSheet,
    View
} from 'react-native';

export default function WorkoutDashboardScreen() {
    const { t, i18n } = useTranslation();
    const { theme } = useTheme();
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
                day: d.toLocaleDateString(i18n.language === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'narrow' }),
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
        }, [i18n.language])
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
        <ScrollScreenLayout
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={theme.primary}
                />
            }
        >
            <Card
                onPress={() => router.push('/workout/calendar')}
                style={layoutStyles.heroCard}
            >
                <View style={layoutStyles.heroStatsRow}>
                    <View style={layoutStyles.heroStatItem}>
                        <Typography.Meta style={{ fontSize: 10, fontWeight: '800', color: theme.textSecondary, letterSpacing: 1, marginBottom: 4 }}>{t('sessions').toUpperCase()}</Typography.Meta>
                        <Typography.Subtitle style={layoutStyles.statValue}>🗓️ {stats.sessions}</Typography.Subtitle>
                        <Typography.Meta style={{ fontSize: 10, color: theme.textSecondary }}>{t('completed')}</Typography.Meta>
                    </View>
                    <View style={[layoutStyles.heroStatSeparator, { backgroundColor: theme.border + '20' }]} />

                    <View style={[layoutStyles.heroStatItem]}>
                        <Typography.Meta style={{ fontSize: 10, fontWeight: '800', color: theme.textSecondary, letterSpacing: 1, marginBottom: 4 }}>{t('avgTime').toUpperCase()}</Typography.Meta>
                        <Typography.Subtitle style={layoutStyles.statValue}>⏱️ {stats.avgDuration}{t('min')}</Typography.Subtitle>
                        <Typography.Meta style={{ fontSize: 10, color: theme.textSecondary }}>{t('perSession')}</Typography.Meta>
                    </View>
                </View>

                <View style={[layoutStyles.heroDivider, { backgroundColor: theme.border + '15' }]} />


                <View style={layoutStyles.headerRow}>
                    <Typography.Subtitle style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{t('weeklyActivity')}</Typography.Subtitle>
                    <FontAwesome name="chevron-right" size={12} color={theme.textSecondary} />
                </View>

                <View style={layoutStyles.weekRow}>
                    {consistency.map(day => (
                        <View key={day.date} style={layoutStyles.dayCol}>
                            <View
                                style={[
                                    layoutStyles.dayBox,
                                    { backgroundColor: theme.surface === '#FFFFFF' ? '#F0F0F0' : 'rgba(255,255,255,0.05)', borderColor: theme.border + '20' },
                                    day.workedOut && { backgroundColor: theme.primary, borderColor: theme.primary }
                                ]}
                            >

                                {day.workedOut && (
                                    <FontAwesome name="check" size={10} color="white" />
                                )}
                            </View>
                            <Typography.Meta style={[{ fontSize: 11, color: theme.textSecondary }, day.workedOut && { color: theme.text, fontWeight: 'bold' }]}>
                                {day.day}
                            </Typography.Meta>
                        </View>
                    ))}
                </View>
            </Card>


            <Card style={[layoutStyles.activeCard, { borderLeftColor: theme.primary }]}>
                <View style={layoutStyles.activeHeader}>
                    <Typography.Subtitle style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 0 }}>
                        {activeWorkout ? t('activeSession') : t('workout')}
                    </Typography.Subtitle>
                    {activeWorkout && (
                        <View style={[layoutStyles.liveIndicator, { backgroundColor: theme.primary + '20' }]}>
                            <View style={[layoutStyles.liveDot, { backgroundColor: theme.primary }]} />
                            <Typography.Meta style={{ fontSize: 10, fontWeight: 'bold', color: theme.primary, letterSpacing: 0.5 }}>{t('live')}</Typography.Meta>
                        </View>
                    )}

                </View>

                {activeWorkout ? (
                    <View style={layoutStyles.activeContent}>
                        <Typography.Body style={[layoutStyles.activeTime, { color: theme.textSecondary }]}>
                            {t('startedAt')}{' '}
                            {new Date(activeWorkout.start_time).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </Typography.Body>

                        <Button
                            label={t('resumeSession')}
                            onPress={handleStartWorkout}
                        />
                    </View>
                ) : (
                    <View style={layoutStyles.activeContent}>
                        <Typography.Body style={[layoutStyles.activePromo, { color: theme.textSecondary }]}>
                            {t('readyToCrush')}
                        </Typography.Body>
                        <Button
                            label={t('startNewWorkout')}
                            onPress={handleStartWorkout}
                        />
                    </View>
                )}
            </Card>


            <Card>
                <Typography.Subtitle style={{ marginBottom: 12 }}>{t('history')}</Typography.Subtitle>
                <View style={layoutStyles.recentContainer}>

                    {allWorkouts.length === 0 ? (
                        <EmptyState message={t('noWorkoutsRecorded')} icon={"history"} />
                    ) : (
                        allWorkouts.slice(0, 3).map(workout => (

                            <Card
                                key={workout.id}
                                onPress={() => router.push(`/(tabs)/history/${workout.id}`)}
                                style={layoutStyles.recentCard}
                            >
                                <View style={layoutStyles.recentRow}>
                                    <View style={layoutStyles.recentLeft}>
                                        <Typography.Body style={[layoutStyles.recentTitle, { color: theme.text }]}>
                                            {new Date(workout.date).toLocaleDateString(i18n.language === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).charAt(0).toUpperCase() + new Date(workout.date).toLocaleDateString(i18n.language === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).slice(1)}
                                        </Typography.Body>

                                        <Typography.Meta style={[layoutStyles.recentMeta, { color: theme.textSecondary }]}>
                                            {workout.end_time
                                                ? `${new Date(workout.start_time).toLocaleTimeString([],
                                                    { hour: '2-digit', minute: '2-digit' }
                                                )} - ${new Date(workout.end_time).toLocaleTimeString([],
                                                    { hour: '2-digit', minute: '2-digit' }
                                                )}`
                                                : t('incomplete')}
                                        </Typography.Meta>
                                    </View>

                                    <FontAwesome
                                        name={workout.status === 'finished' ? "check-circle" : "clock-o"}
                                        size={24}
                                        color={workout.status === 'finished' ? theme.primary : theme.secondary}
                                    />
                                </View>
                            </Card>


                        ))
                    )}
                </View>
            </Card>
        </ScrollScreenLayout>
    );
}

const layoutStyles = StyleSheet.create({
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
    },

    heroDivider: {
        height: 1,
        marginBottom: 20,
    },

    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 2,
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
        marginBottom: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },

    activeCard: {
        marginBottom: 20,
        borderLeftWidth: 4,
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
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },

    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    activeContent: {
        marginTop: 4,
    },
    activeTime: {
        marginBottom: 16,
    },
    activePromo: {
        marginBottom: 16,
        fontSize: 15,
    },
    recentContainer: {
        rowGap: 12,
    },
    recentCard: {
        padding: 16,
        marginBottom: 0,
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
    recentTitle: {
        fontWeight: '600',
        fontSize: 15,
    },
    recentMeta: {
        fontSize: 12,
        marginTop: 4,
    },
});