import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { muscleGroupLabel } from '@/src/modules/exercises/taxonomyLabels'
import type { MuscleBalanceEntry } from '../muscleBalance'

// Sets per Muscle Group as horizontal bars: length encodes the count (NN/g),
// with the number beside it so colour is never the only cue.
export function MuscleBalanceBars({ entries }: { entries: readonly MuscleBalanceEntry[] }) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const max = entries[0]?.count ?? 0

    return (
        <View style={styles.list}>
            {entries.map((entry) => (
                <View
                    key={entry.group ?? 'other'}
                    style={styles.row}
                    accessible
                    accessibilityLabel={`${muscleGroupLabel(t, entry.group)}: ${t('setsCount', { count: entry.count })}`}
                >
                    <Typography.Label color={'text'} numberOfLines={1} style={styles.label}>
                        {muscleGroupLabel(t, entry.group)}
                    </Typography.Label>
                    <View style={[styles.track, { backgroundColor: theme.inputBackground }]}>
                        <View
                            style={[
                                styles.fill,
                                {
                                    backgroundColor: theme.primary,
                                    width: `${max > 0 ? Math.round((entry.count / max) * 100) : 0}%`,
                                },
                            ]}
                        />
                    </View>
                    <Typography.Label color={'textSecondary'} numeric style={styles.count}>
                        {entry.count}
                    </Typography.Label>
                </View>
            ))}
        </View>
    )
}

const styles = StyleSheet.create({
    list: {
        gap: Spacing.sm + Spacing.xs,
        padding: Spacing.md,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm + Spacing.xs,
    },
    label: {
        width: 96,
    },
    track: {
        flex: 1,
        height: 8,
        borderRadius: Radius.pill,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: Radius.pill,
    },
    count: {
        width: 28,
        textAlign: 'right',
    },
})
