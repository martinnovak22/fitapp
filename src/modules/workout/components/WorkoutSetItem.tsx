import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { Set as WorkoutSet } from '@/src/db/workouts'
import { Button } from '@/src/modules/core/components/Button'
import { Typography } from '@/src/modules/core/components/Typography'
import { formatDuration } from '@/src/utils/formatters'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { useIsActive, useReorderableDrag } from 'react-native-reorderable-list'
import { useTheme } from '../../core/hooks/useTheme'
import { SET_BASE_HEIGHT, SUBSET_HEIGHT, calculateSetHeight, parseSubSets } from '../workoutUtils'

interface Props<T extends WorkoutSet = WorkoutSet> {
    set: T
    index: number
    isReadOnly: boolean
    onEdit: (set: T) => void
    onDelete: (setId: number) => void
}

/**
 * Renders an individual workout set item within a session.
 * Follows the renderItem pattern from DraggableFlatList.
 *
 * Wrapped in `React.memo` so unrelated parent re-renders (timer ticks, modal
 * open/close, in-flight saves) do not re-render every row. Drag/active state
 * is read from `useReorderableDrag`/`useIsActive` context, which still
 * updates the row when its own identity changes.
 */
function WorkoutSetItemInner<T extends WorkoutSet = WorkoutSet>({
    set,
    index,
    isReadOnly,
    onEdit,
    onDelete,
}: Props<T>) {
    const drag = useReorderableDrag()
    const isActive = useIsActive()
    const { t } = useTranslation()
    const { theme } = useTheme()
    const totalHeight = calculateSetHeight(set.sub_sets)

    const renderSetDetails = (s: WorkoutSet) => {
        const parts = []
        if (s.weight != null) parts.push(`${s.weight}${t('kg')}`)
        if (s.reps != null) parts.push(`${s.reps} ${t('repsShort')}`)
        if (s.distance != null) parts.push(`${s.distance}m`)
        if (s.duration != null) parts.push(formatDuration(s.duration))

        return parts.join(' × ') || t('noData')
    }

    return (
        <View
            style={[
                styles.card,
                {
                    borderBottomColor: theme.border + '15',
                    backgroundColor: isActive ? theme.surface : 'transparent',
                    height: totalHeight,
                    transform: [{ scale: isActive ? 0.9 : 1 }],
                },
            ]}
        >
            <View style={[styles.innerContent, { height: totalHeight, flexDirection: 'row' }]}>
                <TouchableOpacity
                    onPress={() => !isReadOnly && onEdit(set)}
                    disabled={isReadOnly || isActive}
                    activeOpacity={0.7}
                    style={{ flex: 1 }}
                    accessibilityRole={'button'}
                    accessibilityLabel={`${t('set')} ${index + 1}: ${renderSetDetails(set)}`}
                    accessibilityHint={isReadOnly ? undefined : t('editSet')}
                >
                    <View style={[styles.mainRow, { height: SET_BASE_HEIGHT }]}>
                        <Typography.Meta weight="bold" style={styles.index}>
                            #{index + 1}
                        </Typography.Meta>
                        <Typography.Label weight="bold" color="text" style={styles.detailsText}>
                            {renderSetDetails(set)}
                        </Typography.Label>
                    </View>

                    {set.sub_sets &&
                        parseSubSets(set.sub_sets).map((ss, idx) => (
                            <View key={idx} style={styles.subSetRow}>
                                <View style={[styles.indentLine, { backgroundColor: theme.primary }]} />
                                <Typography.Meta weight="semibold">
                                    {t('drop')} {idx + 1}: {ss.weight ?? 0}
                                    {t('kg')} × {ss.reps ?? 0} {t('repsShort')}
                                </Typography.Meta>
                            </View>
                        ))}
                </TouchableOpacity>

                <View style={[styles.actions, { gap: Spacing.sm, height: SET_BASE_HEIGHT }]}>
                    {!isReadOnly && !isActive && (
                        <Button
                            leftIcon={'trash'}
                            onPress={() => onDelete(set.id)}
                            variant={'text'}
                            size={'sm'}
                            accessibilityLabel={t('deleteSetTitle')}
                            labelStyle={{ color: theme.error }}
                        />
                    )}
                    {!isReadOnly && (
                        <TouchableOpacity
                            onLongPress={drag}
                            delayLongPress={200}
                            style={styles.dragHandle}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole={'button'}
                            accessibilityLabel={t('reorder')}
                            accessibilityHint={t('holdToDrag')}
                        >
                            <FontAwesome name={'reorder'} size={14} color={theme.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    )
}

export const WorkoutSetItem = React.memo(WorkoutSetItemInner) as typeof WorkoutSetItemInner

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
    },
    detailsText: {
        flex: 1,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
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
        borderRadius: Radius.pill,
        marginRight: Spacing.sm,
        opacity: 0.8,
    },
})
