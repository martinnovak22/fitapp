import { Theme } from '@/src/constants/Colors';
import { Exercise, ExerciseRepository } from '@/src/db/exercises';
import { WorkoutRepository } from '@/src/db/workouts';
import { Card } from '@/src/modules/core/components/Card';
import { EmptyState } from '@/src/modules/core/components/EmptyState';
import { FullScreenImageModal } from '@/src/modules/core/components/FullScreenImageModal';
import { ScreenHeader } from '@/src/modules/core/components/ScreenHeader';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { Typography } from '@/src/modules/core/components/Typography';
import { showToast } from '@/src/modules/core/utils/toast';
import { formatExerciseType, formatMuscleGroup } from '@/src/utils/formatters';
import { useIsFocused } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ExerciseHistoryGraph } from './components/ExerciseHistoryGraph';


export default function ExerciseDetailScreen() {
    const { t } = useTranslation();
    const { id } = useLocalSearchParams();
    const [exercise, setExercise] = useState<Exercise | null>(null);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [showImageFullScreen, setShowImageFullScreen] = useState(false);
    const isFocused = useIsFocused();

    const loadData = useCallback(async () => {
        if (id) {
            const exercise = await ExerciseRepository.getById(Number(id));
            if (!exercise) {
                router.replace('/(tabs)/exercises');
                return;
            }
            setExercise(exercise || null);

            if (exercise) {
                const data = await WorkoutRepository.getExerciseHistory(exercise.id);
                setHistoryData(data);
            }
        }
    }, [id]);

    useEffect(() => {
        if (isFocused) {
            loadData();
        }
    }, [isFocused, loadData]);



    if (!exercise) {
        return (
            <ScreenLayout>
                <Typography.Body>{t('loading')}</Typography.Body>
            </ScreenLayout>
        );
    }

    const handleDelete = () => {
        showToast.confirm({
            title: t('delete'),
            message: t('deleteExerciseConfirm'),
            icon: 'trash',
            action: {
                label: t('delete'),
                onPress: async () => {
                    if (exercise) {
                        await ExerciseRepository.delete(exercise.id);
                        router.replace('/(tabs)/exercises');
                        showToast.success({ title: 'Exercise Deleted' });
                    }
                }
            }
        });
    };

    return (
        <ScreenLayout>
            <ScreenHeader
                title={exercise.name}
                onDelete={handleDelete}
                rightAction={{
                    label: t('edit'),
                    onPress: () => router.push(`/(tabs)/exercises/add?id=${exercise.id}`)
                }}
            />

            <ScrollView showsVerticalScrollIndicator={false}>
                <Card>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', height: 120 }}>
                        <View style={{ flexDirection: 'column', gap: 14, justifyContent: "space-between" }}>
                            <View>
                                <Typography.Label>{t('type')}</Typography.Label>
                                <Typography.Body>{formatExerciseType(exercise.type)}</Typography.Body>
                            </View>
                            <View>
                                <Typography.Label>{t('muscleGroup')}</Typography.Label>
                                <Typography.Body>{exercise.muscle_group ? formatMuscleGroup(exercise.muscle_group) : t('notSpecified')}</Typography.Body>
                            </View>
                        </View>

                        {exercise.photo_uri && (
                            <TouchableOpacity
                                style={styles.photoContainer}
                                onPress={() => setShowImageFullScreen(true)}
                                activeOpacity={0.9}
                            >
                                <Image
                                    key={exercise.photo_uri}
                                    source={{ uri: exercise.photo_uri }}
                                    style={styles.photo}
                                />
                            </TouchableOpacity>
                        )}
                    </View>
                    {historyData.length > 0 ? (
                        <ExerciseHistoryGraph
                            exercise={exercise}
                            data={historyData}
                        />
                    ) : (
                        <EmptyState
                            message={t('statsComingSoon')}
                            icon={"line-chart"}
                            style={{ backgroundColor: Theme.surface }}
                        />
                    )}
                </Card>
                <View style={{ height: 40 }} />
                <FullScreenImageModal
                    visible={showImageFullScreen}
                    onClose={() => setShowImageFullScreen(false)}
                    imageUri={exercise.photo_uri || null}
                />
            </ScrollView>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    photoContainer: {
        width: "50%",
        height: 120,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    photo: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
});
