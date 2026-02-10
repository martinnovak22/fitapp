import { Spacing } from '@/src/constants/Spacing';
import { GlobalStyles } from '@/src/constants/Styles';
import { Set as WorkoutSet } from '@/src/db/workouts';
import { formatDuration } from '@/src/utils/formatters';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useIsActive, useReorderableDrag } from 'react-native-reorderable-list';
import { useTheme } from '../../core/hooks/useTheme';
import { SET_BASE_HEIGHT, SUBSET_HEIGHT, calculateSetHeight } from '../workoutUtils';

interface Props<T extends WorkoutSet = WorkoutSet> {
    set: T;
    index: number;
    isReadOnly: boolean;
    onEdit: (set: T) => void;
    onDelete: (setId: number) => void;
}

/**
 * Renders an individual workout set item within a session.
 * Follows the renderItem pattern from DraggableFlatList.
 */
export function WorkoutSetItem<T extends WorkoutSet = WorkoutSet>({
    set,
    index,
    isReadOnly,
    onEdit,
    onDelete,
}: Props<T>) {
    const drag = useReorderableDrag();
    const isActive = useIsActive();
    const { t } = useTranslation();
    const { theme } = useTheme();
    const totalHeight = calculateSetHeight(set.sub_sets);

    const renderSetDetails = (s: WorkoutSet) => {
        const parts = [];
        if (s.weight != null) parts.push(`${s.weight}${t('kg')}`);
        if (s.reps != null) parts.push(`${s.reps} ${t('repsShort')}`);
        if (s.distance != null) parts.push(`${s.distance}m`);
        if (s.duration != null) parts.push(formatDuration(s.duration));

        return parts.join(' × ') || t('noData');
    };

    return (
        <View
            style={[
                styles.card,
                {
                    borderBottomColor: theme.border + '15',
                    backgroundColor: isActive ? theme.surface : 'transparent',
                    height: totalHeight,
                    transform: [{ scale: isActive ? 0.9 : 1 }]
                }
            ]}
        >
            <View style={[styles.innerContent, { height: totalHeight, flexDirection: 'row' }]}>
                <TouchableOpacity
                    onPress={() => !isReadOnly && onEdit(set)}
                    disabled={isReadOnly || isActive}
                    activeOpacity={0.7}
                    style={{ flex: 1 }}
                >
                    <View style={[styles.mainRow, { height: SET_BASE_HEIGHT }]}>
                        <Text style={[styles.index, { color: theme.textSecondary }]}>#{index + 1}</Text>
                        <Text style={[GlobalStyles.text, styles.detailsText, { color: theme.text }]}>
                            {renderSetDetails(set)}
                        </Text>
                    </View>

                    {set.sub_sets && JSON.parse(set.sub_sets).map((ss: any, idx: number) => (
                        <View key={idx} style={styles.subSetRow}>
                            <View style={[styles.indentLine, { backgroundColor: theme.primary }]} />
                            <Text style={[styles.subSetText, { color: theme.textSecondary }]}>
                                {t('drop')} {idx + 1}: {ss.weight}{t('kg')} × {ss.reps} {t('repsShort')}
                            </Text>
                        </View>
                    ))}
                </TouchableOpacity>

                <View style={[styles.actions, { gap: Spacing.sm, height: SET_BASE_HEIGHT }]}>
                    {!isReadOnly && !isActive && (
                        <TouchableOpacity
                            onPress={() => onDelete(set.id)}
                            style={styles.deleteButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <FontAwesome name={"trash"} size={14} color={theme.error} />
                        </TouchableOpacity>
                    )}
                    {!isReadOnly && (
                        <TouchableOpacity
                            onLongPress={drag}
                            delayLongPress={200}
                            style={styles.dragHandle}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <FontAwesome name={"reorder"} size={14} color={theme.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        width: '100%',
        borderBottomWidth: 1,
    },
    innerContent: {
        width: '100%',
        paddingLeft: Spacing.md,
        paddingRight: Spacing.xs,
    },
    dragHandle: {
        padding: Spacing.md,
        marginLeft: Spacing.xs,
    },
    mainRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    index: {
        width: 28,
        fontSize: 10,
        fontWeight: '700',
    },
    detailsText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    deleteButton: {
        padding: Spacing.sm,
    },
    subSetRow: {
        height: SUBSET_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 28, // Keep alignment with index
        paddingBottom: Spacing.md,
    },
    indentLine: {
        width: 2,
        height: '60%',
        borderRadius: 1,
        marginRight: Spacing.sm,
        opacity: 0.8,
    },
    subSetText: {
        fontSize: 13,
        fontWeight: '600',
    }
});