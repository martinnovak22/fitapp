import { StyleSheet, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { useTheme } from '../hooks/useTheme'
import { Typography } from './Typography'

type MiniBar = {
    key: string
    label: string
    value: number
    // Bold label and a dot under it (today, this week).
    current?: boolean
    // Drawn as an outline: something is under way but not counted yet.
    pending?: boolean
}

type MiniBarChartProps = {
    bars: readonly MiniBar[]
    height?: number
}

const MIN_BAR = 12

// A row of vertical bars whose length encodes the value (NN/g: length reads
// faster than colour or area). Empty values show a short neutral stub so the
// axis of time stays visible.
export function MiniBarChart({ bars, height = 56 }: MiniBarChartProps) {
    const { theme } = useTheme()
    const max = Math.max(...bars.map((bar) => bar.value), 1)

    return (
        <View style={styles.row}>
            {bars.map((bar) => {
                const barHeight = bar.value > 0 ? Math.max(MIN_BAR, (bar.value / max) * height) : MIN_BAR / 2
                return (
                    <View key={bar.key} style={styles.column}>
                        <View style={[styles.track, { height }]}>
                            <View
                                style={[
                                    styles.bar,
                                    { height: bar.pending && bar.value === 0 ? MIN_BAR : barHeight },
                                    bar.value > 0
                                        ? { backgroundColor: theme.primary }
                                        : bar.pending
                                          ? { borderWidth: 1.5, borderColor: theme.primary }
                                          : { backgroundColor: theme.inputBackgroundActive },
                                ]}
                            />
                        </View>
                        <Typography.Meta
                            color={bar.current ? 'text' : 'textSecondary'}
                            weight={bar.current ? 'bold' : 'regular'}
                            numberOfLines={1}
                        >
                            {bar.label}
                        </Typography.Meta>
                        <View style={[styles.currentMark, bar.current && { backgroundColor: theme.text }]} />
                    </View>
                )
            })}
        </View>
    )
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
    },
    column: {
        flex: 1,
        alignItems: 'center',
        gap: Spacing.xs,
    },
    track: {
        justifyContent: 'flex-end',
    },
    bar: {
        width: 16,
        borderRadius: Radius.xs + 2,
    },
    currentMark: {
        width: 4,
        height: 4,
        borderRadius: Radius.pill,
    },
})
