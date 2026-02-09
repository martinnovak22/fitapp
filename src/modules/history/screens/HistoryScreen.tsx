import { Theme } from '@/src/constants/Colors';
import { Workout, WorkoutRepository } from '@/src/db/workouts';
import { Card } from '@/src/modules/core/components/Card';
import { EmptyState } from '@/src/modules/core/components/EmptyState';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { Typography } from '@/src/modules/core/components/Typography';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

export default function HistoryScreen() {
    const { t, i18n } = useTranslation();
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
        <Card onPress={() => router.push(`/(tabs)/history/${item.id}`)}>
            <View style={styles.workoutItem}>
                <View style={styles.workoutInfo}>
                    <Typography.Body style={styles.workoutDate}>
                        {new Date(item.date).toLocaleDateString(i18n.language === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).charAt(0).toUpperCase() + new Date(item.date).toLocaleDateString(i18n.language === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).slice(1)}
                    </Typography.Body>
                    <Typography.Meta style={styles.workoutTime}>
                        {item.start_time ? new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        {item.end_time ? ` - ${new Date(item.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ` (${t('inProgress')})`}
                    </Typography.Meta>
                    {item.note && (
                        <Typography.Meta style={styles.workoutNote}>
                            "{item.note}"
                        </Typography.Meta>
                    )}
                </View>
                <FontAwesome
                    name={item.status === 'finished' ? "check-circle" : "clock-o"}
                    size={24}
                    color={item.status === 'finished' ? Theme.primary : Theme.secondary}
                />
            </View>
        </Card>
    );

    return (
        <ScreenLayout>
            <FlatList
                data={workouts}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listPadding}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={<EmptyState message={t('noWorkoutsYet')} icon={"calendar-o"} />}
            />
        </ScreenLayout>
    );
}
const styles = StyleSheet.create({
    workoutItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    workoutInfo: {
        flex: 1,
        paddingRight: 12,
    },
    workoutDate: {
        fontWeight: 'bold',
    },
    workoutTime: {
        marginTop: 4,
    },
    workoutNote: {
        fontStyle: 'italic',
        marginTop: 4,
    },
    listPadding: {
        paddingTop: 16,
        paddingBottom: 20,
    },
});
