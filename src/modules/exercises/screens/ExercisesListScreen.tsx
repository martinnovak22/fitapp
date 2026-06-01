import { ThemeType } from '@/src/constants/Colors'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { GlobalStyles } from '@/src/constants/Styles'
import { Exercise } from '@/src/db/exercises'
import { Button } from '@/src/modules/core/components/Button'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { exportExercisesToCSV, importExercisesFromCSV } from '@/src/utils/csv'
import { formatExerciseType, formatMuscleGroup } from '@/src/utils/formatters'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import { TFunction } from 'i18next'
import React, { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    ActivityIndicator,
    Image,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native'
import ReorderableList, { reorderItems, useIsActive, useReorderableDrag } from 'react-native-reorderable-list'
import { ListSeparator } from '../../core/components/ListSeparator'
import { useExercises } from '../hooks/useExercises'

import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

const ExerciseListItem = React.memo(
    ({
        item,
        index,
        theme,
        t,
        animateOnEnter,
    }: {
        item: Exercise
        index: number
        theme: ThemeType
        t: TFunction
        animateOnEnter: boolean
    }) => {
        const drag = useReorderableDrag()
        const isDragged = useIsActive()
        const scale = useSharedValue(1)

        React.useEffect(() => {
            scale.value = withTiming(isDragged ? 0.9 : 1, { duration: 100 })
        }, [isDragged, scale])

        const animatedStyle = useAnimatedStyle(() => ({
            transform: [{ scale: scale.value }],
        }))

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
                        animatedStyle,
                    ]}
                >
                    <TouchableOpacity
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => router.push(`/(tabs)/exercises/${item.id}`)}
                        disabled={isDragged}
                        accessibilityRole={'button'}
                        accessibilityLabel={`${item.name}, ${t(formatExerciseType(item.type))}`}
                        accessibilityHint={t('details')}
                    >
                        {item.photo_uri ? (
                            <Image source={{ uri: item.photo_uri }} style={styles.thumbnail} />
                        ) : (
                            <View
                                style={[
                                    styles.thumbnail,
                                    styles.placeholderThumbnail,
                                    { backgroundColor: theme.surface, borderColor: theme.border },
                                ]}
                            >
                                <FontAwesome name={'camera'} size={20} color={theme.textSecondary + '40'} />
                            </View>
                        )}
                        <View style={styles.content}>
                            <Typography.Body weight="bold" style={styles.title}>
                                {item.name}
                            </Typography.Body>
                            <Typography.Meta style={styles.subtitle}>
                                {item.muscle_group ? `${formatMuscleGroup(item.muscle_group)} • ` : ''}
                                {t(formatExerciseType(item.type))}
                            </Typography.Meta>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPressIn={drag}
                        style={styles.dragHandle}
                        accessibilityRole={'button'}
                        accessibilityLabel={t('reorder')}
                        accessibilityHint={t('holdToDrag')}
                    >
                        <FontAwesome name={'bars'} size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>
        )
    }
)
ExerciseListItem.displayName = 'ExerciseListItem'

export default function ExercisesListScreen() {
    const { t } = useTranslation()
    const navigation = useNavigation()
    const { exercises, hasLoaded, loadError, loadExercises, handleReorder, isReordering } = useExercises()
    const { theme } = useTheme()
    const animatedItemIdsRef = useRef<Set<number>>(new Set())
    const [showAndroidExportSheet, setShowAndroidExportSheet] = useState(false)
    const [isImporting, setIsImporting] = useState(false)

    const handleExportPress = useCallback(() => {
        if (Platform.OS === 'android') {
            setShowAndroidExportSheet(true)
            return
        }

        exportExercisesToCSV(exercises)
    }, [exercises])

    const handleAndroidExportAction = useCallback(
        (action: 'share' | 'save') => {
            setShowAndroidExportSheet(false)
            exportExercisesToCSV(exercises, { androidAction: action })
        },
        [exercises]
    )

    const handleImportPress = useCallback(async () => {
        if (isImporting) return
        await importExercisesFromCSV(loadExercises, {
            onProcessingStateChange: setIsImporting,
        })
    }, [isImporting, loadExercises])

    useFocusEffect(
        useCallback(() => {
            const hasExercises = exercises.length > 0
            navigation.getParent()?.setOptions({
                headerTitle: t('exercises'),
                headerLeft: () => null,
                headerRight: () => (
                    <View style={{ flexDirection: 'row', gap: Spacing.md, marginRight: Spacing.md }}>
                        <TouchableOpacity
                            onPress={handleExportPress}
                            disabled={!hasExercises || isImporting}
                            style={{ opacity: hasExercises && !isImporting ? 1 : 0.3 }}
                            accessibilityRole={'button'}
                            accessibilityLabel={t('export')}
                        >
                            <FontAwesome name={'upload'} size={20} color={theme.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleImportPress}
                            disabled={isImporting}
                            accessibilityRole={'button'}
                            accessibilityLabel={t('import')}
                        >
                            {isImporting ? (
                                <ActivityIndicator size={"small"} color={theme.primary} />
                            ) : (
                                <FontAwesome name={'download'} size={20} color={theme.primary} />
                            )}
                        </TouchableOpacity>
                    </View>
                ),
            })
        }, [navigation, exercises.length, theme.primary, handleExportPress, handleImportPress, isImporting, t])
    )

    const renderItem = useCallback(
        ({ item, index }: { item: Exercise; index: number }) => {
            const animateOnEnter = !animatedItemIdsRef.current.has(item.id)
            if (animateOnEnter) {
                animatedItemIdsRef.current.add(item.id)
            }
            return <ExerciseListItem item={item} index={index} theme={theme} t={t} animateOnEnter={animateOnEnter} />
        },
        [theme, t]
    )

    return (
        <ScreenLayout>
            {!hasLoaded ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size={"large"} color={theme.primary} />
                </View>
            ) : loadError && exercises.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <EmptyState message={loadError} icon={"exclamation-circle"} />
                    <Button label={t('retry')} onPress={loadExercises} style={{ marginTop: Spacing.md }} />
                </View>
            ) : exercises.length === 0 ? (
                <EmptyState message={t('noExercises')} subMessage={t('addFirstExercise')} icon={'list'} />
            ) : (
                <ReorderableList
                    data={exercises}
                    onReorder={({ from, to }) => {
                        const newData = reorderItems(exercises, from, to)
                        handleReorder(newData)
                    }}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    ItemSeparatorComponent={ListSeparator}
                    shouldUpdateActiveItem
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 80 }}
                />
            )}
            {isReordering && (
                <View style={styles.reorderOverlay}>
                    <ActivityIndicator size={"small"} color={theme.primary} />
                    <Typography.Meta weight="semibold" color="text">
                        {t('saving')}
                    </Typography.Meta>
                </View>
            )}
            <TouchableOpacity
                style={GlobalStyles.fab}
                onPress={() => router.push('/(tabs)/exercises/add')}
                accessibilityRole={'button'}
                accessibilityLabel={t('addExercise')}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
                <FontAwesome name={'plus'} size={32} color={theme.onPrimary} />
            </TouchableOpacity>

            <Modal
                visible={showAndroidExportSheet}
                transparent
                animationType="fade"
                onRequestClose={() => setShowAndroidExportSheet(false)}
            >
                <Pressable style={styles.sheetBackdrop} onPress={() => setShowAndroidExportSheet(false)}>
                    <View />
                </Pressable>
                <View style={[styles.sheetContainer, { backgroundColor: theme.card }]}>
                    <Typography.Body weight="bold" style={styles.sheetTitle}>
                        {t('chooseExportAction')}
                    </Typography.Body>

                    <TouchableOpacity
                        style={[
                            styles.sheetActionButton,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                        onPress={() => handleAndroidExportAction('share')}
                        accessibilityRole={'button'}
                        accessibilityLabel={t('shareFile')}
                    >
                        <FontAwesome name={'share-alt'} size={18} color={theme.primary} />
                        <Typography.Label weight="semibold" color="text">
                            {t('shareFile')}
                        </Typography.Label>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.sheetActionButton,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                        onPress={() => handleAndroidExportAction('save')}
                        accessibilityRole={'button'}
                        accessibilityLabel={t('saveToPhone')}
                    >
                        <FontAwesome name={'download'} size={18} color={theme.primary} />
                        <Typography.Label weight="semibold" color="text">
                            {t('saveToPhone')}
                        </Typography.Label>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.sheetCancelButton, { borderColor: theme.border }]}
                        onPress={() => setShowAndroidExportSheet(false)}
                        accessibilityRole={'button'}
                        accessibilityLabel={t('cancel')}
                    >
                        <Typography.Label weight="semibold">{t('cancel')}</Typography.Label>
                    </TouchableOpacity>
                </View>
            </Modal>

            <Modal visible={isImporting} transparent animationType="fade" statusBarTranslucent>
                <View style={styles.importOverlay}>
                    <View
                        style={[styles.importOverlayCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    >
                        <ActivityIndicator size={"large"} color={theme.primary} />
                        <Typography.Label weight="semibold" color="text" style={styles.importOverlayText}>
                            {t('importInProgress')}
                        </Typography.Label>
                    </View>
                </View>
            </Modal>
        </ScreenLayout>
    )
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
        lineHeight: 20,
    },
    subtitle: {
        lineHeight: 18,
    },
    thumbnail: {
        width: 44,
        height: 44,
        borderRadius: Radius.sm,
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
    sheetBackdrop: {
        flex: 1,
        backgroundColor: '#00000066',
    },
    sheetContainer: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.lg,
        borderTopWidth: 1,
        borderTopLeftRadius: Radius.lg,
        borderTopRightRadius: Radius.lg,
    },
    sheetTitle: {
        marginBottom: Spacing.md,
    },
    sheetActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
        marginBottom: Spacing.sm,
    },
    sheetCancelButton: {
        marginTop: Spacing.xs,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        borderRadius: Radius.md,
        borderWidth: 1,
    },
    importOverlay: {
        flex: 1,
        backgroundColor: '#00000066',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    importOverlayCard: {
        minWidth: 220,
        borderRadius: Radius.md,
        borderWidth: 1,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        gap: Spacing.sm,
    },
    importOverlayText: {
        textAlign: 'center',
    },
    reorderOverlay: {
        position: 'absolute',
        top: Spacing.md,
        right: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        borderRadius: Radius.pill,
        backgroundColor: '#00000099',
    },
})
