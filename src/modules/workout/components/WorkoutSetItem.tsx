import { GlobalStyles } from '@/src/constants/Styles';
import { Set as WorkoutSet } from '@/src/db/workouts';
import { formatDuration } from '@/src/utils/formatters';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { useTheme } from '../../core/hooks/useTheme';

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { DraggableItem } from '@/src/modules/core/components/DraggableItem';
import { SharedValue } from 'react-native-reanimated';

import { SET_BASE_HEIGHT, SUBSET_HEIGHT, calculateSetHeight } from '../workoutUtils';

interface Props<T extends WorkoutSet = WorkoutSet> {
    set: T;
    index: number;
    itemCount: number;
    isReadOnly: boolean;
    isDragging?: boolean;
    onEdit: (set: T) => void;
    onDelete: (setId: number) => void;
    onDrop: (fromIndex: number, translationY: number, itemHeight: number) => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    activeIndex: SharedValue<number>;
    translationY: SharedValue<number>;
}

export function WorkoutSetItem<T extends WorkoutSet = WorkoutSet>({
    set,
    index,
    itemCount,
    isReadOnly,
    isDragging,
    onEdit,
    onDelete,
    onDrop,
    onDragStart,
    onDragEnd,
    activeIndex,
    translationY,
}: Props<T>) {
    const { theme } = useTheme();
    const totalHeight = calculateSetHeight(set.sub_sets);


    const renderSetDetails = (s: WorkoutSet) => {
        const parts = [];
        if (s.weight != null) parts.push(`${s.weight}kg`);
        if (s.reps != null) parts.push(`${s.reps} reps`);
        if (s.distance != null) parts.push(`${s.distance}m`);
        if (s.duration != null) parts.push(formatDuration(s.duration));

        return parts.join(' × ') || 'No data';
    };

    return (
        <DraggableItem
            index={index}
            itemCount={itemCount}
            itemHeight={totalHeight}
            enabled={!isReadOnly}
            onDrop={(idx, ty) => onDrop(idx, ty, totalHeight)}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            useLayoutAnimation={!isDragging}
            style={[styles.draggable, { borderBottomColor: theme.border + '15' }]}
            activeIndex={activeIndex}
            translationY={translationY}
        >
            <TouchableOpacity
                onPress={() => !isReadOnly && onEdit(set)}
                style={[styles.content, { height: totalHeight }]}
                disabled={isReadOnly || isDragging}
                activeOpacity={0.7}
            >
                <View style={[styles.mainRow, { height: SET_BASE_HEIGHT }]}>
                    <Text style={[styles.index, { color: theme.textSecondary }]}>#{index + 1}</Text>
                    <Text style={[GlobalStyles.text, styles.detailsText, { color: theme.text }]}>
                        {renderSetDetails(set)}
                    </Text>

                    <View style={styles.actions}>
                        {!isReadOnly && !isDragging && (
                            <TouchableOpacity onPress={() => onDelete(set.id)} style={styles.deleteButton}>
                                <FontAwesome name={"trash"} size={14} color={theme.error} />
                            </TouchableOpacity>
                        )}
                        <FontAwesome name={"reorder"} size={12} color={theme.textSecondary} style={{ marginLeft: 8 }} />

                    </View>

                </View>

                {set.sub_sets && JSON.parse(set.sub_sets).map((ss: any, idx: number) => (
                    <View key={idx} style={styles.subSetRow}>
                        <View style={[styles.indentLine, { backgroundColor: theme.primary }]} />
                        <Text style={[styles.subSetText, { color: theme.textSecondary }]}>
                            Drop {idx + 1}: {ss.weight}kg × {ss.reps} reps
                        </Text>
                    </View>
                ))}

            </TouchableOpacity>
        </DraggableItem>

    );
}

const styles = StyleSheet.create({
    draggable: {
        backgroundColor: 'transparent',
        borderBottomWidth: 1,
    },


    content: {
        width: '100%',
        paddingHorizontal: 16,
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
        padding: 8,
    },
    subSetRow: {
        height: SUBSET_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 28,
        paddingBottom: 16,
    },

    indentLine: {
        width: 2,
        height: '60%',
        borderRadius: 1,
        marginRight: 10,
        opacity: 0.8,
    },


    subSetText: {
        fontSize: 13,
        fontWeight: '600',
    }


});