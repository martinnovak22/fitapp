import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { LineChart } from 'react-native-gifted-charts'
import { FontSize } from '@/src/constants/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { formatLocalizedDate, parseLocalDate } from '@/src/utils/dateTime'
import { AXIS_SECTIONS, type ChartPoint, fitAxis } from '../../exerciseInsights'

type ProgressChartProps = {
    points: readonly ChartPoint[]
    language: string
    // Formats an axis value in the metric's unit.
    formatValue: (value: number) => string
    // For times where faster is better: lower values plot higher.
    inverted?: boolean
}

const CHART_HEIGHT = 180
const Y_LABEL_WIDTH = 44
// The first point sits far enough in that its date label ("24. 8.") is not
// clipped at the plot's left edge.
const INITIAL_SPACING = 36
const END_SPACING = 20

// One line of the best value per Workout over time: a thin line with a
// light area fill, round axis steps and day/month labels.
export function ProgressChart({ points, language, formatValue, inverted = false }: ProgressChartProps) {
    const { theme } = useTheme()
    const [width, setWidth] = useState(0)

    const reference = inverted ? Math.max(...points.map((p) => p.value)) * 1.05 || 1 : 0
    const data = useMemo(
        () =>
            points.map((point) => ({
                value: inverted ? reference - point.value : point.value,
                label: formatLocalizedDate(parseLocalDate(point.date), language, { day: 'numeric', month: 'numeric' }),
            })),
        [inverted, language, points, reference]
    )
    const axis = fitAxis(data.map((d) => d.value))
    // The chart draws from zero, so values are shifted down by the axis start.
    const shifted = data.map((d) => ({ ...d, value: d.value - axis.offset }))
    const plotWidth = Math.max(0, width - Y_LABEL_WIDTH - 8)
    const spacing = data.length > 1 ? Math.max(40, (plotWidth - INITIAL_SPACING - END_SPACING) / (data.length - 1)) : 0

    return (
        <View style={styles.root} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
            {width > 0 && (
                <LineChart
                    data={shifted}
                    width={plotWidth}
                    height={CHART_HEIGHT}
                    color={theme.primary}
                    thickness={2}
                    dataPointsColor={theme.primary}
                    dataPointsRadius={3}
                    areaChart
                    startFillColor={theme.primary}
                    endFillColor={theme.primary}
                    startOpacity={0.16}
                    endOpacity={0}
                    curved
                    initialSpacing={INITIAL_SPACING}
                    endSpacing={END_SPACING}
                    spacing={spacing}
                    noOfSections={AXIS_SECTIONS}
                    maxValue={axis.maxValue}
                    stepValue={axis.stepValue}
                    xAxisColor={theme.border}
                    yAxisColor={'transparent'}
                    rulesColor={theme.hairline}
                    rulesType={'solid'}
                    yAxisLabelWidth={Y_LABEL_WIDTH}
                    yAxisTextStyle={[styles.axisText, { color: theme.textSecondary }]}
                    xAxisLabelTextStyle={[styles.axisText, { color: theme.textSecondary }]}
                    formatYLabel={(label) => {
                        const value = Number.parseFloat(label) + axis.offset
                        return formatValue(inverted ? reference - value : value)
                    }}
                    scrollToEnd
                    isAnimated={false}
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    root: {
        minHeight: CHART_HEIGHT + 32,
    },
    axisText: {
        fontSize: FontSize.xs,
        fontVariant: ['tabular-nums'],
    },
})
