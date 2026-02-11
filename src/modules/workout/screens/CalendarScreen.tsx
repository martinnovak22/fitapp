import { Spacing } from '@/src/constants/Spacing';
import { GlobalStyles } from '@/src/constants/Styles';
import { Workout, WorkoutRepository } from '@/src/db/workouts';
import { Button } from '@/src/modules/core/components/Button';
import { Card } from '@/src/modules/core/components/Card';
import { EmptyState } from '@/src/modules/core/components/EmptyState';
import { ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { Typography } from '@/src/modules/core/components/Typography';
import { useTheme } from '@/src/modules/core/hooks/useTheme';
import { formatHourMinute, formatLocalizedDate } from '@/src/utils/dateTime';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Modal,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface MarkedDates {
    [date: string]: {
        marked?: boolean;
        selected?: boolean;
        selectedColor?: string;
        dotColor?: string;
    };
}

export default function CalendarScreen() {
    const { t, i18n } = useTranslation();
    const { theme } = useTheme();
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
                dotColor: theme.primary,
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
            router.replace(`/(tabs)/history/${id}`);
        }
    };

    return (
        <ScrollScreenLayout
            contentContainerStyle={styles.scrollContent}
            style={styles.container}
        >
            <Animated.View entering={FadeInDown.delay(70).duration(360)}>
                <Card style={styles.calendarCard}>
                    <Calendar
                        theme={{
                            backgroundColor: 'transparent',
                            calendarBackground: 'transparent',
                            textSectionTitleColor: theme.textSecondary,
                            selectedDayBackgroundColor: theme.primary,
                            selectedDayTextColor: theme.onPrimary,
                            todayTextColor: theme.primary,
                            dayTextColor: theme.text,
                            textDisabledColor: theme.inputBackgroundActive,
                            dotColor: theme.primary,
                            selectedDotColor: theme.onPrimary,
                            arrowColor: theme.primary,
                            disabledArrowColor: theme.border,
                            monthTextColor: theme.text,
                            indicatorColor: theme.primary,
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
                                    selectedColor: theme.primary + '40'
                                }
                            } : {})
                        }}
                        onDayPress={handleDayPress}
                        hideExtraDays={false}
                        showSixWeeks={true}
                    />
                </Card>
            </Animated.View>

            {selectedDate && (
                dayWorkouts.length > 0 ? (
                    <Animated.View entering={FadeInDown.delay(140).duration(360)}>
                        <Typography.Subtitle style={[styles.dayHeader, { color: theme.text }]}>
                            {formatLocalizedDate(selectedDate, i18n.language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }, true)}
                        </Typography.Subtitle>

                        {dayWorkouts.map((w, index) => (
                            <Animated.View key={w.id} entering={FadeInDown.delay(170 + Math.min(index, 8) * 45).duration(320)}>
                                <Card
                                    style={styles.workoutCard}
                                    onPress={() => handleOpenSummary(w)}
                                >
                                    <View style={styles.workoutCardRow}>
                                        <View>
                                            <Typography.Body style={[styles.workoutTime, { color: theme.text }]}>
                                                {formatHourMinute(w.start_time)} {w.end_time ? `- ${formatHourMinute(w.end_time)}` : `(${t('inProgress')})`}
                                            </Typography.Body>
                                            <Typography.Meta style={[styles.workoutStatus, { color: theme.textSecondary }]}>
                                                {w.status === 'finished' ? t('completed') : t('activeSession')}
                                            </Typography.Meta>
                                        </View>
                                        <View style={styles.workoutAction}>
                                            <Typography.Meta style={[styles.viewSummaryText, { color: theme.primary }]}>{t('viewSummary')}</Typography.Meta>
                                            <FontAwesome name="chevron-right" size={12} color={theme.primary} />
                                        </View>
                                    </View>
                                </Card>
                            </Animated.View>
                        ))}
                    </Animated.View>
                ) : (
                    <View>
                        <Typography.Subtitle style={[styles.dayHeader, { color: theme.text }]}>
                            {formatLocalizedDate(selectedDate, i18n.language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }, true)}
                        </Typography.Subtitle>
                        <EmptyState message={t('noWorkoutsRecorded')} icon={"calendar-o"} />
                    </View>
                )
            )}

            <Modal
                animationType="fade"
                transparent={true}
                visible={!!modalWorkout}
                onRequestClose={() => setModalWorkout(null)}
            >
                <TouchableOpacity
                    style={[styles.modalOverlay, { backgroundColor: theme.overlayScrim }]}
                    activeOpacity={1}
                    onPress={() => setModalWorkout(null)}
                >
                    <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.inputBackgroundActive }]}>
                        <Typography.Title style={[styles.modalTitle, { color: theme.text }]}>
                            {t('workoutSummary')}
                        </Typography.Title>
                        {modalWorkout && (
                            <Typography.Meta style={[styles.modalDate, { color: theme.textSecondary }]}>
                                {formatLocalizedDate(modalWorkout.date, i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })}
                                {' - '}
                                {formatHourMinute(modalWorkout.start_time)}
                                {modalWorkout.end_time ? ` - ${formatHourMinute(modalWorkout.end_time)}` : ` (${t('inProgress')})`}
                            </Typography.Meta>
                        )}

                        <ScrollView style={styles.summaryScroll} contentContainerStyle={styles.summaryScrollContent}>
                            {workoutSets.length > 0 ? (
                                workoutSets.map((item, index) => (
                                    <View key={index} style={[styles.summaryRow, { borderBottomColor: theme.inputBackground }]}>
                                        <Typography.Body style={[styles.summaryText, { color: theme.text }]}>
                                            {item.exercise_name}
                                        </Typography.Body>
                                        <Typography.Body style={[styles.summaryCount, { color: theme.primary }]}>
                                            {item.count} {t('sets')}
                                        </Typography.Body>
                                    </View>
                                ))
                            ) : (
                                <Typography.Body style={[styles.emptySummary, { color: theme.textSecondary }]}>
                                    {t('noSetsRecorded')}
                                </Typography.Body>
                            )}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <Button
                                label={t('close')}
                                onPress={() => setModalWorkout(null)}
                                variant="secondary"
                                style={{ flex: 1 }}
                            />
                            <Button
                                label={t('viewHistory')}
                                onPress={handleViewHistory}
                                style={{ flex: 1 }}
                            />
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </ScrollScreenLayout>

    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: Spacing.xl2,
    },
    calendarCard: {
        padding: Spacing.sm,
        marginBottom: Spacing.lg,
        height: 380,
    },
    dayHeader: {
        ...GlobalStyles.subtitle,
        marginBottom: Spacing.md,
        marginTop: Spacing.md,
    },
    workoutCard: {
        marginBottom: Spacing.md,
        padding: Spacing.md,
    },
    workoutCardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    workoutTime: {
        ...GlobalStyles.text,
        fontWeight: 'bold',
        fontSize: 14,
    },
    workoutStatus: {
        ...GlobalStyles.text,
        fontSize: 12,
        marginTop: 2,
    },
    workoutAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    viewSummaryText: {
        ...GlobalStyles.text,
        fontSize: 12,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        maxHeight: '70%',
        borderRadius: Spacing.md,
        padding: Spacing.lg,
        borderWidth: 1,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    modalTitle: {
        ...GlobalStyles.subtitle,
        marginBottom: Spacing.xs,
    },
    modalDate: {
        ...GlobalStyles.text,
        fontSize: 14,
        marginBottom: Spacing.lg,
    },
    summaryScroll: {
        marginBottom: Spacing.lg,
        maxHeight: 300,
    },
    summaryScrollContent: {
        paddingVertical: Spacing.xs,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
    },
    summaryText: {
        ...GlobalStyles.text,
        flex: 1,
    },
    summaryCount: {
        ...GlobalStyles.text,
        fontWeight: 'bold',
        marginLeft: Spacing.md,
    },
    emptySummary: {
        ...GlobalStyles.text,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: Spacing.lg,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: Spacing.md,
    },
});
