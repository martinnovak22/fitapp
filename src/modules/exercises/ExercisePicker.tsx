import React from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, type ListRenderItem, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import type { Exercise } from '@/src/db/exercises'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { formatExerciseType } from '@/src/utils/formatters'
import { ExerciseStats, type HeadlineStat } from './ExerciseStats'

type Props = {
    exercises: Exercise[]
    onPick: (exercise: Exercise) => void
    selectedId?: number | null
}

const ROW_HEIGHT = 64
const EMPTY_PLACEHOLDER = '—'

export const ExercisePicker = ({ exercises, onPick, selectedId }: Props) => {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const [stats, setStats] = React.useState<Map<number, HeadlineStat | null>>(() => new Map())

    React.useEffect(() => {
        let cancelled = false
        ExerciseStats.headlineStats(exercises).then((result) => {
            if (!cancelled) setStats(result)
        })
        return () => {
            cancelled = true
        }
    }, [exercises])

    const renderItem: ListRenderItem<Exercise> = React.useCallback(
        ({ item }) => {
            const stat = stats.get(item.id) ?? null
            const isSelected = item.id === selectedId
            return (
                <TouchableOpacity
                    onPress={() => onPick(item)}
                    style={[
                        styles.row,
                        { borderBottomColor: `${theme.border}20` },
                        isSelected && {
                            backgroundColor: theme.inputBackgroundActive,
                            borderLeftColor: theme.primary,
                        },
                    ]}
                    accessibilityRole={'button'}
                    accessibilityLabel={item.name}
                    accessibilityState={{ selected: isSelected }}
                >
                    <View style={styles.rowText}>
                        <Typography.Body weight="semibold" numberOfLines={1}>
                            {item.name}
                        </Typography.Body>
                        <Typography.Meta style={styles.subtext} numberOfLines={1}>
                            {t(formatExerciseType(item.type))}
                        </Typography.Meta>
                    </View>
                    <Typography.Label weight="bold" color="text" style={styles.stat} numberOfLines={1}>
                        {stat ? stat.formatted : EMPTY_PLACEHOLDER}
                    </Typography.Label>
                </TouchableOpacity>
            )
        },
        [onPick, stats, t, theme, selectedId]
    )

    return (
        <FlatList
            data={exercises}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            style={[styles.list, { backgroundColor: theme.background }]}
            getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
            initialNumToRender={8}
            windowSize={5}
            keyboardShouldPersistTaps={'handled'}
            showsVerticalScrollIndicator
        />
    )
}

const styles = StyleSheet.create({
    list: {
        borderRadius: Radius.sm,
        marginVertical: Spacing.sm,
        maxHeight: ROW_HEIGHT * 4,
    },
    row: {
        height: ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        borderBottomWidth: 1,
        // Reserve the selected left-accent width up front so selecting a row
        // never shifts its content horizontally.
        borderLeftWidth: 3,
        borderLeftColor: 'transparent',
        gap: Spacing.md,
    },
    rowText: {
        flex: 1,
        minWidth: 0,
    },
    subtext: {
        marginTop: 2,
    },
    stat: {
        textAlign: 'right',
    },
})
