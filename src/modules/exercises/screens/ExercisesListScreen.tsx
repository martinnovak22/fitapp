import { GlobalStyles } from '@/src/constants/Styles';
import { Exercise } from '@/src/db/exercises';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { useTheme } from '@/src/modules/core/hooks/useTheme';
import { exportExercisesToCSV, importExercisesFromCSV } from '@/src/utils/csv';
import { formatExerciseType, formatMuscleGroup } from '@/src/utils/formatters';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useNavigation } from 'expo-router';
import React, { useCallback, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ReorderableList, { reorderItems, useIsActive, useReorderableDrag } from 'react-native-reorderable-list';
import { ListSeparator } from '../../core/components/ListSeparator';
import { useExercises } from '../hooks/useExercises';

const ExerciseListItem = React.memo(({ item, theme, t }: { item: Exercise, theme: any, t: any }) => {
    const drag = useReorderableDrag();
    const isDragged = useIsActive();

    return (
        <View
            style={[
                GlobalStyles.card,
                styles.cardInner,
                {
                    backgroundColor: isDragged ? theme.surface : theme.card,
                    borderColor: theme.border,
                    transform: [{ scale: isDragged ? 0.95 : 1 }]
                }
            ]}
        >
            <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                onPress={() => router.push(`/(tabs)/exercises/${item.id}`)}
                disabled={isDragged}
            >
                {item.photo_uri ? (
                    <Image source={{ uri: item.photo_uri }} style={styles.thumbnail} />
                ) : (
                    <View style={[styles.thumbnail, styles.placeholderThumbnail, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <FontAwesome name={"camera"} size={20} color={theme.textSecondary + '40'} />
                    </View>
                )}
                <View style={styles.content}>
                    <Text style={[GlobalStyles.text, styles.title, { color: theme.text }]}>
                        {item.name}
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                        {item.muscle_group
                            ? `${formatMuscleGroup(item.muscle_group)} • `
                            : ''}
                        {t(formatExerciseType(item.type))}
                    </Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity onPressIn={drag} style={styles.dragHandle}>
                <FontAwesome name={"bars"} size={20} color={theme.textSecondary} />
            </TouchableOpacity>
        </View>
    );
});

export default function ExercisesListScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation();
    const { exercises, loadExercises, handleReorder } = useExercises();
    const { theme } = useTheme();

    useLayoutEffect(() => {
        const hasExercises = exercises.length > 0;
        navigation.getParent()?.setOptions({
            headerRight: () => (
                <View style={{ flexDirection: 'row', gap: 16, marginRight: 16 }}>
                    <TouchableOpacity
                        onPress={() => exportExercisesToCSV(exercises)}
                        disabled={!hasExercises}
                        style={{ opacity: hasExercises ? 1 : 0.3 }}
                    >
                        <FontAwesome name={"upload"} size={20} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => importExercisesFromCSV(loadExercises)}>
                        <FontAwesome name={"download"} size={20} color={theme.primary} />
                    </TouchableOpacity>
                </View>
            ),
        });
    }, [navigation, exercises, loadExercises, theme.primary]);

    const renderItem = useCallback(({ item }: { item: Exercise }) => {
        return <ExerciseListItem item={item} theme={theme} t={t} />;
    }, [theme, t]);

    return (
        <ScreenLayout>
            <ReorderableList
                data={exercises}
                onReorder={({ from, to }) => {
                    const newData = reorderItems(exercises, from, to);
                    handleReorder(newData);
                }}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                ItemSeparatorComponent={ListSeparator}
                shouldUpdateActiveItem
                showsVerticalScrollIndicator={false}
            />
            <TouchableOpacity
                style={GlobalStyles.fab}
                onPress={() => router.push('/(tabs)/exercises/add')}
            >
                <FontAwesome name={"plus"} size={32} color={"white"} />
            </TouchableOpacity>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    cardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
    },
    content: {
        flex: 1,
    },
    title: {
        fontWeight: 'bold',
        fontSize: 18,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
    },
    thumbnail: {
        width: 50,
        height: 50,
        borderRadius: 8,
        marginRight: 12,
    },
    placeholderThumbnail: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    dragHandle: {
        padding: 8,
        marginLeft: 8,
    },
});