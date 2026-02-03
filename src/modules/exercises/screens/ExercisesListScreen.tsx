import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { Exercise, ExerciseRepository } from '@/src/db/exercises';
import { DraggableItem } from '@/src/modules/core/components/DraggableItem';
import { ListSeparator } from '@/src/modules/core/components/ListSeparator';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { useSortableList } from '@/src/modules/core/hooks/useSortableList';
import { exportExercisesToCSV, importExercisesFromCSV } from '@/src/utils/csv';
import { formatExerciseType, formatMuscleGroup } from '@/src/utils/formatters';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, Stack, useFocusEffect, useNavigation } from 'expo-router';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ExercisesListScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation();
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const sortable = useSortableList();

    const loadExercises = useCallback(async () => {
        const data = await ExerciseRepository.getAll();
        setExercises(data);
    }, []);

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
                        <FontAwesome name="upload" size={20} color={Theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => importExercisesFromCSV(loadExercises)}>
                        <FontAwesome name="download" size={20} color={Theme.primary} />
                    </TouchableOpacity>
                </View>
            ),
        });
    }, [navigation, exercises, loadExercises, t]);

    useFocusEffect(
        useCallback(() => {
            loadExercises();
        }, [loadExercises])
    );

    const handleReorder = async (fromIndex: number, translationY: number) => {
        const ITEM_HEIGHT = 80;
        const delta = Math.round(translationY / ITEM_HEIGHT);
        const toIndex = Math.max(0, Math.min(exercises.length - 1, fromIndex + delta));

        if (fromIndex === toIndex) {
            sortable.activeIndex.value = -1;
            sortable.translationY.value = 0;
            return;
        }

        const newExercises = [...exercises];
        const [moved] = newExercises.splice(fromIndex, 1);
        newExercises.splice(toIndex, 0, moved);

        const updated = newExercises.map((ex, idx) => ({ ...ex, position: idx }));
        setExercises(updated);

        await Promise.all(
            updated.map(ex => ExerciseRepository.updatePosition(ex.id, ex.position))
        );

        sortable.activeIndex.value = -1;
        sortable.translationY.value = 0;
    };

    const renderItem = ({ item, index }: { item: Exercise; index: number }) => (
        <DraggableItem
            index={index}
            itemCount={exercises.length}
            itemHeight={80}
            onDrop={handleReorder}
            onDragStart={() => setDraggingId(item.id)}
            onDragEnd={() => setDraggingId(null)}
            useLayoutAnimation={draggingId !== item.id}
            style={GlobalStyles.card}
            activeIndex={sortable.activeIndex}
            translationY={sortable.translationY}
        >
            <TouchableOpacity
                onPress={() => draggingId === null && router.push(`/(tabs)/exercises/${item.id}`)}
            >
                <View style={styles.row}>
                    {item.photo_uri ? (
                        <Image source={{ uri: item.photo_uri }} style={styles.thumbnail} />
                    ) : (
                        <View style={[styles.thumbnail, styles.placeholderThumbnail]}>
                            <FontAwesome name={"camera"} size={20} color={"rgba(255,255,255,0.2)"} />
                        </View>
                    )}
                    <View style={styles.content}>
                        <Text style={[GlobalStyles.text, styles.title]}>
                            {item.name}
                        </Text>
                        <Text style={styles.subtitle}>
                            {item.muscle_group
                                ? `${formatMuscleGroup(item.muscle_group)} • `
                                : ''}
                            {formatExerciseType(item.type)}
                        </Text>
                    </View>
                    <View style={styles.icons}>
                        <FontAwesome
                            name={'chevron-right'}
                            size={12}
                            color={Theme.primary}
                        />
                    </View>
                </View>
            </TouchableOpacity>
        </DraggableItem>
    );

    return (
        <ScreenLayout style={{ padding: 0 }}>
            <Stack.Screen
                options={{
                    title: t('exercises'),
                }}
            />
            <FlatList
                data={exercises}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={ListSeparator}
                style={{ padding: 16 }}
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
    row: {
        flexDirection: 'row',
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
        color: Theme.textSecondary,
    },
    thumbnail: {
        width: 50,
        height: 50,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    placeholderThumbnail: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    icons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    listContent: {
        paddingBottom: 80,
    },
});