import { Exercise } from '@/src/db/exercises'
import { Spacing } from '@/src/constants/Spacing'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import {
    ExerciseTypeMetadata,
    formatCompactSetLabel,
    formatHeadlineStat,
    getSetMetricValue,
    type PrimaryMetric,
} from '@/src/modules/exercises/ExerciseTypeMetadata'
import type { BestSetEntry, SessionSummary } from '@/src/modules/exercises/ExerciseStats'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { LineChart } from 'react-native-gifted-charts'

interface ExerciseHistoryGraphProps {
    exercise: Exercise
    data: BestSetEntry[]
    summary: SessionSummary | null
    dominantMetric: PrimaryMetric | null
}

export const ExerciseHistoryGraph = ({
    exercise,
    data,
    summary,
    dominantMetric,
}: ExerciseHistoryGraphProps) => {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const [graphWidth, setGraphWidth] = useState(0)

    const effectiveDominant: PrimaryMetric =
        dominantMetric ?? ExerciseTypeMetadata.defaultDominantMetric(exercise.type)
    const isInverted = ExerciseTypeMetadata.isBetterLower(exercise.type, effectiveDominant)

    const rawValues = useMemo(
        () => data.map(({ set }) => getSetMetricValue(set, effectiveDominant)),
        [data, effectiveDominant]
    )

    // For inverted plots ("faster is better"), reflect each value around a reference
    // ceiling so the smaller raw value sits higher on the chart.
    const invertReference = useMemo(() => {
        if (!isInverted || rawValues.length === 0) return 0
        const maxRaw = Math.max(...rawValues)
        return maxRaw * 1.05 || 1
    }, [isInverted, rawValues])

    const processedData = useMemo(() => {
        return data.map(({ date, set }, idx) => {
            const raw = rawValues[idx] ?? 0
            const value = isInverted ? invertReference - raw : raw
            const d = new Date(date)
            return {
                value,
                label: `${d.getDate()}/${d.getMonth() + 1}`,
                dataPointText: formatCompactSetLabel(exercise.type, effectiveDominant, set),
            }
        })
    }, [data, rawValues, isInverted, invertReference, exercise.type, effectiveDominant])

    const stats = useMemo(() => {
        if (!summary) return null
        return {
            max: formatHeadlineStat(exercise.type, effectiveDominant, summary.max),
            avg: formatHeadlineStat(exercise.type, effectiveDominant, summary.avg),
        }
    }, [summary, exercise.type, effectiveDominant])

    const contextLine = useMemo(() => {
        if (!summary?.contextAvgDistance) return null
        return `${t('avgDistance')} ${ExerciseTypeMetadata.formatAxisLabel(
            'distance',
            summary.contextAvgDistance
        )}`
    }, [summary, t])

    const maxDisplay = processedData.length ? Math.max(...processedData.map((d) => d.value)) : 0

    const yAxisProps = (() => {
        if (maxDisplay === 0) return { noOfSections: 4, maxValue: 100 }

        if (maxDisplay <= 10) {
            return {
                noOfSections: Math.max(1, Math.ceil(maxDisplay)),
                maxValue: Math.ceil(maxDisplay),
                stepValue: 1,
            }
        }
        const sections = 4
        const step = maxDisplay / sections

        const magnitudes = [1, 2, 2.5, 5]
        const power = Math.pow(10, Math.floor(Math.log10(step)))
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

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>{t('progress')}</Text>
                {contextLine && (
                    <Text style={[styles.context, { color: theme.textSecondary }]}>
                        {contextLine}
                    </Text>
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

                        // Labels carry the full set ("2.4km·30:00"), so points need more breathing room.
                        const minSpacing = 80
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
                                scrollToEnd
                                scrollAnimation={false}
                                yAxisLabelWidth={yAxisLabelWidth}
                                yAxisLabelContainerStyle={{ width: yAxisLabelWidth, marginLeft: -10 }}
                                formatYLabel={(val) => {
                                    const display = parseFloat(val)
                                    const raw = isInverted ? invertReference - display : display
                                    return ExerciseTypeMetadata.formatAxisLabel(effectiveDominant, raw)
                                }}
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
    context: {
        fontSize: 12,
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
