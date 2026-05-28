import { Exercise } from '@/src/db/exercises'
import { Spacing } from '@/src/constants/Spacing'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import {
    ExerciseTypeMetadata,
    getSetMetricValue,
    type PrimaryMetric,
} from '@/src/modules/exercises/ExerciseTypeMetadata'
import type { BestSetEntry, SessionSummary } from '@/src/modules/exercises/ExerciseStats'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { LineChart } from 'react-native-gifted-charts'

interface ExerciseHistoryGraphProps {
    exercise: Exercise
    data: BestSetEntry[]
    summary: SessionSummary | null
}

const metricLabelKey: Record<PrimaryMetric, string> = {
    weight: 'weight',
    reps: 'reps',
    distance: 'meters',
    duration: 'time',
}

export const ExerciseHistoryGraph = ({ exercise, data, summary }: ExerciseHistoryGraphProps) => {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const adapter = ExerciseTypeMetadata.for(exercise.type)
    const [selectedMetric, setSelectedMetric] = useState<PrimaryMetric>(adapter.primaryMetric)
    const [graphWidth, setGraphWidth] = useState(0)

    const toggleMetrics = useMemo<PrimaryMetric[]>(() => {
        const metrics: PrimaryMetric[] = [adapter.primaryMetric]
        if (adapter.secondaryMetric) metrics.push(adapter.secondaryMetric)
        return metrics
    }, [adapter])

    const selectedMetricAdapter = ExerciseTypeMetadata.forMetric(selectedMetric)

    const processedData = useMemo(() => {
        if (!data.length) return []

        const primary = selectedMetric
        const showSecondary =
            selectedMetric === adapter.primaryMetric && adapter.secondaryMetric !== null
        const secondary = showSecondary ? adapter.secondaryMetric : null

        return data.map(({ date, set }) => {
            const value = getSetMetricValue(set, primary)
            const primaryLabel = ExerciseTypeMetadata.forMetric(primary).format(value)
            let dataPointText = primaryLabel
            if (secondary) {
                const secondaryLabel = ExerciseTypeMetadata.forMetric(secondary).format(
                    getSetMetricValue(set, secondary)
                )
                dataPointText = `${primaryLabel} × ${secondaryLabel}`
            }
            const d = new Date(date)
            return {
                value,
                label: `${d.getDate()}/${d.getMonth() + 1}`,
                dataPointText,
            }
        })
    }, [data, selectedMetric, adapter])

    const stats = useMemo(() => {
        const metricSummary = summary?.[selectedMetric]
        if (!metricSummary) return null
        const { format, unit } = selectedMetricAdapter
        const withUnit = (formatted: string) =>
            unit && unit !== 'reps' ? `${formatted}${unit}` : formatted
        return {
            max: withUnit(format(metricSummary.max)),
            avg: withUnit(format(metricSummary.avg)),
        }
    }, [summary, selectedMetric, selectedMetricAdapter])

    const maxValue = processedData.length ? Math.max(...processedData.map((d) => d.value)) : 0

    const yAxisProps = (() => {
        if (maxValue === 0) return { noOfSections: 4, maxValue: 100 }

        if (maxValue <= 10) {
            return { noOfSections: maxValue, maxValue: maxValue, stepValue: 1 }
        }
        const sections = 4
        let step = maxValue / sections

        const magnitudes = [1, 2, 2.5, 5]
        let power = Math.pow(10, Math.floor(Math.log10(step)))
        let bestStep = power

        for (const m of magnitudes) {
            if (m * power >= step) {
                bestStep = m * power
                break
            }
        }
        if (bestStep < step) bestStep = 10 * power

        return {
            noOfSections: sections,
            maxValue: bestStep * sections,
            stepValue: bestStep,
        }
    })()

    const renderToggle = (metric: PrimaryMetric) => (
        <TouchableOpacity
            key={metric}
            onPress={() => setSelectedMetric(metric)}
            style={[
                styles.toggleButton,
                selectedMetric === metric && [styles.toggleButtonActive, { backgroundColor: theme.primary }],
            ]}
        >
            <Text
                style={[
                    styles.toggleText,
                    { color: theme.textSecondary },
                    selectedMetric === metric && { color: theme.onPrimary },
                ]}
            >
                {t(metricLabelKey[metric])}
            </Text>
        </TouchableOpacity>
    )

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>{t('progress')}</Text>
                {toggleMetrics.length > 1 && (
                    <View style={[styles.toggleGroup, { backgroundColor: theme.background }]}>
                        {toggleMetrics.map(renderToggle)}
                    </View>
                )}
            </View>

            {stats && (
                <View style={styles.statsRow}>
                    <View style={[styles.statItem, { backgroundColor: theme.background }]}>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t('personalBest')}</Text>
                        <Text style={[styles.statValue, { color: theme.text }]}>{stats.max}</Text>
                    </View>
                    <View style={[styles.statItem, { backgroundColor: theme.background }]}>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t('average')}</Text>
                        <Text style={[styles.statValue, { color: theme.text }]}>{stats.avg}</Text>
                    </View>
                </View>
            )}

            <View
                onLayout={(e) => setGraphWidth(e.nativeEvent.layout.width)}
                style={[styles.graphWrapper, { borderTopColor: theme.border + '40' }]}
            >
                {graphWidth > 0 && processedData.length > 0 ? (
                    (() => {
                        const yAxisLabelWidth = 60
                        const availableWidth = graphWidth - yAxisLabelWidth - 16

                        const minSpacing = 60
                        const initialSpacing = 30
                        const endSpacing = 30

                        let spacing = minSpacing
                        if (processedData.length > 1) {
                            const fitSpacing =
                                (availableWidth - initialSpacing - endSpacing) / (processedData.length - 1)
                            spacing = Math.max(minSpacing, fitSpacing)
                        }

                        return (
                            <LineChart
                                data={processedData}
                                color={theme.primary}
                                thickness={3}
                                dataPointsColor={theme.primary}
                                dataPointsRadius={4}
                                focusedDataPointColor={theme.primary}
                                xAxisColor={theme.border}
                                yAxisColor={theme.border}
                                yAxisTextStyle={[styles.axisText, { color: theme.textSecondary }]}
                                xAxisLabelTextStyle={[styles.axisText, { color: theme.textSecondary }]}
                                noOfSections={yAxisProps.noOfSections}
                                stepValue={yAxisProps.stepValue}
                                maxValue={yAxisProps.maxValue}
                                areaChart
                                startFillColor={theme.primary}
                                endFillColor={theme.primary}
                                startOpacity={0.2}
                                endOpacity={0.01}
                                spacing={spacing}
                                initialSpacing={initialSpacing}
                                endSpacing={endSpacing}
                                curved
                                width={availableWidth}
                                height={220}
                                hideRules={false}
                                rulesColor={theme.border}
                                rulesType="dashed"
                                isAnimated
                                yAxisLabelWidth={yAxisLabelWidth}
                                yAxisLabelContainerStyle={{ width: yAxisLabelWidth, marginLeft: -10 }}
                                formatYLabel={(val) =>
                                    selectedMetricAdapter.formatAxisLabel(parseFloat(val))
                                }
                                pointerConfig={{
                                    activatePointersOnLongPress: true,
                                    pointerStripUptoDataPoint: true,
                                    pointerStripColor: theme.primary,
                                    pointerStripWidth: 2,
                                    strokeDashArray: [2, 5],
                                    pointerColor: theme.primary,
                                    radius: 6,
                                }}
                            />
                        )
                    })()
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={{ color: theme.textSecondary }}>{t('noHistoryData')}</Text>
                    </View>
                )}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        marginTop: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
    },

    toggleGroup: {
        flexDirection: 'row',
        borderRadius: 10,
        padding: Spacing.xs2,
    },

    toggleButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    toggleButtonActive: {},
    toggleText: {
        fontSize: 12,
        fontWeight: '600',
    },

    statsRow: {
        flexDirection: 'row',
        marginBottom: 24,
        gap: 16,
    },
    statItem: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
    },
    statLabel: {
        fontSize: 12,
        marginBottom: 4,
    },

    statValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    graphWrapper: {
        width: '100%',
        paddingBottom: 10,
        paddingTop: 20,
        borderTopWidth: 0.5,
    },

    axisText: {
        fontSize: 12,
    },
    emptyState: {
        padding: Spacing.xl2,
        alignItems: 'center',
    },
})
