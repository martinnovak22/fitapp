import { ThemeType } from '@/src/constants/Colors';
import { Spacing } from '@/src/constants/Spacing';
import { GlobalStyles } from '@/src/constants/Styles';
import { Exercise } from '@/src/db/exercises';
import { EmptyState } from '@/src/modules/core/components/EmptyState';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { useTheme } from '@/src/modules/core/hooks/useTheme';
import { exportExercisesToCSV, importExercisesFromCSV } from '@/src/utils/csv';
import { formatExerciseType, formatMuscleGroup } from '@/src/utils/formatters';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useNavigation } from 'expo-router';
import { TFunction } from 'i18next';
import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ReorderableList, { reorderItems, useIsActive, useReorderableDrag } from 'react-native-reorderable-list';
import { ListSeparator } from '../../core/components/ListSeparator';
import { useExercises } from '../hooks/useExercises';

import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const ExerciseListItem = React.memo(({
    item,
    index,
    theme,
    t,
    animateOnEnter,
}: {
    item: Exercise;
    index: number;
    theme: ThemeType;
    t: TFunction;
    animateOnEnter: boolean;
}) => {
    const drag = useReorderableDrag();
    const isDragged = useIsActive();
    const scale = useSharedValue(1);

    React.useEffect(() => {
        scale.value = withTiming(isDragged ? 0.9 : 1, { duration: 100 });
    }, [isDragged]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View
            entering={animateOnEnter ? FadeInDown.delay(50 + Math.min(index, 8) * 50).duration(320) : undefined}
            style={styles.itemEnterWrapper}
        >
            <Animated.View
                style={[
                    GlobalStyles.card,
                    styles.cardInner,
                    {
                        backgroundColor: isDragged ? theme.surface : theme.card,
                        borderColor: theme.border,
                    },
                    animatedStyle
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
            </Animated.View>
        </Animated.View>
    );
});

export default function ExercisesListScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation();
    const { exercises, hasLoaded, loadExercises, handleReorder } = useExercises();
    const { theme } = useTheme();
    const animatedItemIdsRef = useRef<Set<number>>(new Set());

    useLayoutEffect(() => {
        const hasExercises = exercises.length > 0;
        navigation.getParent()?.setOptions({
            headerRight: () => (
                <View style={{ flexDirection: 'row', gap: Spacing.md, marginRight: Spacing.md }}>
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

    const renderItem = useCallback(({ item, index }: { item: Exercise; index: number }) => {
        const animateOnEnter = !animatedItemIdsRef.current.has(item.id);
        if (animateOnEnter) {
            animatedItemIdsRef.current.add(item.id);
        }
        return <ExerciseListItem item={item} index={index} theme={theme} t={t} animateOnEnter={animateOnEnter} />;
    }, [theme, t]);

    return (
        <ScreenLayout>
            {!hasLoaded ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : exercises.length === 0 ? (
                <EmptyState
                    message={t('noExercises')}
                    subMessage={t('addFirstExercise')}
                    icon={"list"}
                />
            ) : (
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
                    contentContainerStyle={{ paddingBottom: 80 }}
                />
            )}
            <TouchableOpacity
                style={GlobalStyles.fab}
                onPress={() => router.push('/(tabs)/exercises/add')}
            >
                <FontAwesome name={"plus"} size={32} color={theme.onPrimary} />
            </TouchableOpacity>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    itemEnterWrapper: {
        width: '100%',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm + Spacing.xs,
        paddingHorizontal: Spacing.md,
        borderRadius: Spacing.md,
        minHeight: 56,
    },
    content: {
        flex: 1,
    },
    title: {
        fontWeight: 'bold',
        fontSize: 16,
        lineHeight: 20,
    },
    subtitle: {
        fontSize: 13,
        lineHeight: 18,
    },
    thumbnail: {
        width: 44,
        height: 44,
        borderRadius: 8,
        marginRight: Spacing.md,
    },
    placeholderThumbnail: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    dragHandle: {
        padding: Spacing.sm,
        marginLeft: Spacing.sm,
    },
});
