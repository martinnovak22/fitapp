import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { Set as WorkoutSet } from '@/src/db/workouts';
import { formatDuration } from '@/src/utils/formatters';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { DraggableItem } from '@/src/modules/core/components/DraggableItem';
import { SharedValue } from 'react-native-reanimated';

const ITEM_HEIGHT = 48;

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
    const renderSetDetails = (s: WorkoutSet) => {
        const parts = [];
        if (s.weight != null) parts.push(`${s.weight}kg`);
        if (s.reps != null) parts.push(`${s.reps} reps`);
        if (s.distance != null) parts.push(`${s.distance}m`);
        if (s.duration != null) parts.push(formatDuration(s.duration));
        return parts.join(' x ') || 'No data';
    };

    return (
        <DraggableItem
            index={index}
            itemCount={itemCount}
            itemHeight={ITEM_HEIGHT}
            enabled={!isReadOnly}
            onDrop={onDrop}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            useLayoutAnimation={!isDragging}
            style={styles.container}
            activeIndex={activeIndex}
            translationY={translationY}
        >
            <TouchableOpacity
                onPress={() => !isReadOnly && onEdit(set)}
                style={styles.detailsContainer}
                disabled={isReadOnly || isDragging}
            >
                <Text style={styles.index}>#{index + 1}</Text>

                <Text style={[GlobalStyles.text, styles.detailsText]}>
                    {renderSetDetails(set)}
                </Text>

                <View style={styles.actions}>
                    {!isReadOnly && !isDragging && (
                        <TouchableOpacity onPress={() => onDelete(set.id)} style={styles.deleteButton}>
                            <FontAwesome name={'trash'} size={16} color={Theme.error} />
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        </DraggableItem>
    );
}

const styles = StyleSheet.create({
    container: {
        height: ITEM_HEIGHT,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 16,
    },
    detailsContainer: {
        flex: 1,
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
        height: '100%',
    },
    index: {
        ...GlobalStyles.text,
        width: 32,
        opacity: 0.5,
        fontSize: 13,
    },
    detailsText: {
        flex: 1,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    deleteButton: {
        padding: 8,
        marginRight: -8,
    },
});