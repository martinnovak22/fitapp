import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { Set as WorkoutSet } from '@/src/db/workouts';
import { formatDuration } from '@/src/utils/formatters';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { DraggableItem } from '@/src/modules/core/components/DraggableItem';
import { SharedValue } from 'react-native-reanimated';

const BASE_HEIGHT = 56;
const SUBSET_HEIGHT = 32;

interface Props<T extends WorkoutSet = WorkoutSet> {
    set: T;
    index: number;
    itemCount: number;
    isReadOnly: boolean;
    isDragging?: boolean;
    onEdit: (set: T) => void;
    onDelete: (setId: number) => void;
    onDrop: (fromIndex: number, translationY: number) => void;
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
    const subSetsParsed: any[] = React.useMemo(() => {
        if (!set.sub_sets) return [];
        try {
            return JSON.parse(set.sub_sets) || [];
        } catch (e) {
            return [];
        }
    }, [set.sub_sets]);

    const totalHeight = BASE_HEIGHT + (subSetsParsed.length * SUBSET_HEIGHT);

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
            onDrop={onDrop}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            useLayoutAnimation={!isDragging}
            style={styles.draggable}
            activeIndex={activeIndex}
            translationY={translationY}
        >
            <TouchableOpacity
                onPress={() => !isReadOnly && onEdit(set)}
                style={[styles.content, { height: totalHeight }]}
                disabled={isReadOnly || isDragging}
                activeOpacity={0.7}
            >
                <View style={[styles.mainRow, { height: BASE_HEIGHT }]}>
                    <Text style={styles.index}>#{index + 1}</Text>
                    <Text style={[GlobalStyles.text, styles.detailsText]}>
                        {renderSetDetails(set)}
                    </Text>
                    <View style={styles.actions}>
                        {!isReadOnly && !isDragging && (
                            <TouchableOpacity onPress={() => onDelete(set.id)} style={styles.deleteButton}>
                                <FontAwesome name={'trash'} size={14} color={Theme.error} />
                            </TouchableOpacity>
                        )}
                        <FontAwesome name="reorder" size={12} color={Theme.textSecondary} style={{ opacity: 0.3, marginLeft: 8 }} />
                    </View>
                </View>

                {subSetsParsed.map((ss, idx) => (
                    <View key={idx} style={styles.subSetRow}>
                        <View style={styles.indentLine} />
                        <Text style={styles.subSetText}>
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
        borderBottomColor: 'rgba(255,255,255,0.03)',
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
        color: Theme.textSecondary,
        width: 28,
        fontSize: 10,
        fontWeight: '700',
        opacity: 0.5,
    },
    detailsText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: Theme.text,
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
        opacity: 0.7,
        paddingBottom: 16,
    },
    indentLine: {
        width: 2,
        height: '60%',
        backgroundColor: Theme.primary,
        borderRadius: 1,
        marginRight: 10,
        opacity: 0.5,
    },
    subSetText: {
        fontSize: 12,
        color: Theme.textSecondary,
        fontWeight: '600',
    }
});