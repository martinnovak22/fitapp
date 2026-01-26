import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { Workout, WorkoutRepository } from '@/src/db/workouts';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Calendar } from 'react-native-calendars';

interface MarkedDates {
    [date: string]: {
        marked?: boolean;
        selected?: boolean;
        selectedColor?: string;
        dotColor?: string;
    };
}

export default function CalendarScreen() {
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [markedDates, setMarkedDates] = useState<MarkedDates>({});
    const [selectedDate, setSelectedDate] = useState<string | null>(new Date().toISOString().split('T')[0]);
    const [dayWorkouts, setDayWorkouts] = useState<Workout[]>([]);
    const [modalWorkout, setModalWorkout] = useState<Workout | null>(null);
    const [workoutSets, setWorkoutSets] = useState<{ exercise_name: string; count: number }[]>([]);

    const loadWorkouts = async () => {
        const all = await WorkoutRepository.getAllWorkouts();
        setWorkouts(all);

        const marked: MarkedDates = {};
        all.forEach(w => {
            marked[w.date] = {
                marked: true,
                dotColor: Theme.primary,
            };
        });
        setMarkedDates(marked);

        if (selectedDate) {
            setDayWorkouts(all.filter(w => w.date === selectedDate));
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadWorkouts();
        }, [selectedDate])
    );

    const handleDayPress = (day: { dateString: string }) => {
        setSelectedDate(day.dateString);
        setDayWorkouts(workouts.filter(w => w.date === day.dateString));
    };

    const handleOpenSummary = async (workout: Workout) => {
        setModalWorkout(workout);
        const sets = await WorkoutRepository.getSets(workout.id);
        const summary = sets.reduce((acc, s) => {
            const existing = acc.find(item => item.exercise_name === s.exercise_name);
            if (existing) {
                existing.count++;
            } else {
                acc.push({ exercise_name: s.exercise_name, count: 1 });
            }
            return acc;
        }, [] as { exercise_name: string; count: number }[]);
        setWorkoutSets(summary);
    };

    const handleViewHistory = () => {
        if (modalWorkout) {
            const id = modalWorkout.id;
            setModalWorkout(null);
            router.navigate(`/(tabs)/history/${id}`);
        }
    };

    const formatTime = (isoString: string) => {
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <ScreenLayout>
            <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
                <View style={[GlobalStyles.card, styles.calendarCard]}>
                    <Calendar
                        theme={{
                            backgroundColor: 'transparent',
                            calendarBackground: 'transparent',
                            textSectionTitleColor: Theme.textSecondary,
                            selectedDayBackgroundColor: Theme.primary,
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: Theme.primary,
                            dayTextColor: Theme.text,
                            textDisabledColor: 'rgba(255, 255, 255, 0.1)',
                            dotColor: Theme.primary,
                            selectedDotColor: '#ffffff',
                            arrowColor: Theme.primary,
                            disabledArrowColor: '#d9e1e8',
                            monthTextColor: Theme.text,
                            indicatorColor: Theme.primary,
                            textDayFontFamily: 'System',
                            textMonthFontFamily: 'System',
                            textDayHeaderFontFamily: 'System',
                            textDayFontWeight: '300',
                            textMonthFontWeight: 'bold',
                            textDayHeaderFontWeight: '300',
                            textDayFontSize: 16,
                            textMonthFontSize: 18,
                            textDayHeaderFontSize: 14

                        }}
                        markedDates={{
                            ...markedDates,
                            ...(selectedDate ? {
                                [selectedDate]: {
                                    ...markedDates[selectedDate],
                                    selected: true,
                                    selectedColor: 'rgba(81, 160, 111, 0.3)'
                                }
                            } : {})
                        }}
                        onDayPress={handleDayPress}
                        hideExtraDays={false}
                        showSixWeeks={true}
                    />
                </View>

                {selectedDate && (
                    <View>
                        <Text style={styles.dayHeader}>
                            {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).charAt(0).toUpperCase() + new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).slice(1)}
                        </Text>

                        {dayWorkouts.length > 0 ? (
                            dayWorkouts.map(w => (
                                <TouchableOpacity
                                    key={w.id}
                                    style={styles.workoutCard}
                                    onPress={() => handleOpenSummary(w)}
                                >
                                    <View style={styles.workoutCardRow}>
                                        <View>
                                            <Text style={styles.workoutTime}>
                                                {formatTime(w.start_time)} {w.end_time ? `- ${formatTime(w.end_time)}` : '(In Progress)'}
                                            </Text>
                                            <Text style={styles.workoutStatus}>
                                                {w.status === 'finished' ? 'Completed' : 'Active'}
                                            </Text>
                                        </View>
                                        <View style={styles.workoutAction}>
                                            <Text style={styles.viewSummaryText}>View Summary</Text>
                                            <FontAwesome name="chevron-right" size={12} color={Theme.primary} />
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={styles.noWorkoutContainer}>
                                <Text style={styles.noWorkoutText}>No workouts recorded</Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            <Modal
                visible={!!modalWorkout}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setModalWorkout(null)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setModalWorkout(null)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Workout Summary</Text>
                        <Text style={styles.modalDate}>
                            {modalWorkout ? new Date(modalWorkout.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                        </Text>

                        <ScrollView style={styles.summaryScroll} contentContainerStyle={styles.summaryScrollContent}>
                            {workoutSets.length > 0 ? (
                                workoutSets.map((s, idx) => (
                                    <View key={idx} style={styles.summaryRow}>
                                        <Text style={styles.summaryText}>{s.exercise_name}</Text>
                                        <Text style={styles.summaryCount}>{s.count} {s.count === 1 ? 'set' : 'sets'}</Text>
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.emptySummary}>No exercises logged.</Text>
                            )}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.secondaryButton]}
                                onPress={() => setModalWorkout(null)}
                            >
                                <Text style={styles.secondaryButtonText}>Close</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.primaryButton]}
                                onPress={handleViewHistory}
                            >
                                <Text style={styles.primaryButtonText}>Full History</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    calendarCard: {
        padding: 10,
        marginBottom: 20,
        height: 380,
    },
    dayHeader: {
        ...GlobalStyles.subtitle,
        color: Theme.text,
        marginBottom: 12,
        marginTop: 16,
    },
    workoutCard: {
        backgroundColor: Theme.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    workoutCardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    workoutTime: {
        ...GlobalStyles.text,
        color: Theme.text,
        fontWeight: 'bold',
        fontSize: 14,
    },
    workoutStatus: {
        ...GlobalStyles.text,
        color: Theme.textSecondary,
        fontSize: 12,
        marginTop: 2,
    },
    workoutAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    viewSummaryText: {
        ...GlobalStyles.text,
        color: Theme.primary,
        fontSize: 12,
        fontWeight: '600',
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        maxHeight: '70%',
        backgroundColor: Theme.surface,
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    modalTitle: {
        ...GlobalStyles.subtitle,
        color: Theme.text,
        marginBottom: 4,
    },
    modalDate: {
        ...GlobalStyles.text,
        color: Theme.textSecondary,
        fontSize: 14,
        marginBottom: 20,
    },
    summaryScroll: {
        marginBottom: 24,
        maxHeight: 300,
    },
    summaryScrollContent: {
        paddingVertical: 4,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    summaryText: {
        ...GlobalStyles.text,
        color: Theme.text,
        flex: 1,
    },
    summaryCount: {
        ...GlobalStyles.text,
        color: Theme.primary,
        fontWeight: 'bold',
        marginLeft: 12,
    },
    emptySummary: {
        ...GlobalStyles.text,
        color: Theme.textSecondary,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 20,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    primaryButton: {
        backgroundColor: Theme.primary,
    },
    primaryButtonText: {
        ...GlobalStyles.text,
        color: 'white',
        fontWeight: 'bold',
    },
    secondaryButton: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    secondaryButtonText: {
        ...GlobalStyles.text,
        color: Theme.text,
    },
});
