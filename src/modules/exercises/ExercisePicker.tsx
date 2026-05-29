import { Spacing } from '@/src/constants/Spacing'
import type { Exercise } from '@/src/db/exercises'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { formatExerciseType } from '@/src/utils/formatters'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, type ListRenderItem, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { ExerciseStats, type HeadlineStat } from './ExerciseStats'

type Props = {
    exercises: Exercise[]
    onPick: (exercise: Exercise) => void
}

const ROW_HEIGHT = 64
const EMPTY_PLACEHOLDER = '—'

export const ExercisePicker = ({ exercises, onPick }: Props) => {
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
            return (
                <TouchableOpacity
                    onPress={() => onPick(item)}
                    style={[styles.row, { borderBottomColor: `${theme.border}20` }]}
                    accessibilityRole={'button'}
                    accessibilityLabel={item.name}
                >
                    <View style={styles.rowText}>
                        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <Text style={[styles.subtext, { color: theme.textSecondary }]} numberOfLines={1}>
                            {t(formatExerciseType(item.type))}
                        </Text>
                    </View>
                    <Text style={[styles.stat, { color: theme.text }]} numberOfLines={1}>
                        {stat ? stat.formatted : EMPTY_PLACEHOLDER}
                    </Text>
                </TouchableOpacity>
            )
        },
        [onPick, stats, t, theme]
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
        borderRadius: 10,
        marginVertical: Spacing.sm,
        maxHeight: ROW_HEIGHT * 4,
    },
    row: {
        height: ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        borderBottomWidth: 1,
        gap: Spacing.md,
    },
    rowText: {
        flex: 1,
        minWidth: 0,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
    },
    subtext: {
        fontSize: 11,
        marginTop: 2,
    },
    stat: {
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'right',
    },
})
