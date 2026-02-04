import { Exercise } from '@/src/db/exercises';
import { useTheme } from '@/src/modules/core/hooks/useTheme';
import { formatDuration } from '@/src/utils/formatters';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from "react-native-gifted-charts";



interface ExerciseHistoryGraphProps {
    exercise: Exercise;
    data: any[];
}

type Metric = 'weight' | 'reps' | 'distance' | 'duration';

export const ExerciseHistoryGraph = ({ exercise, data: rawData }: ExerciseHistoryGraphProps) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const [selectedMetric, setSelectedMetric] = useState<Metric>('weight');

    const [graphWidth, setGraphWidth] = useState(0);


    const data = useMemo(() => {
        return rawData;
    }, [rawData]);

    useEffect(() => {
        if (exercise.type === 'bodyweight') {
            setSelectedMetric('reps');
        } else if (exercise.type === 'bodyweight_timer') {
            setSelectedMetric('duration');
        } else if (exercise.type === 'cardio') {
            setSelectedMetric('distance');
        } else {
            setSelectedMetric('weight');
        }
    }, [exercise.type]);

    const processedData = useMemo(() => {
        if (!data.length) return [];

        let getValue = (h: any) => h.max_weight || 0;

        switch (selectedMetric) {
            case 'weight':
                getValue = (h) => h.max_weight || 0;
                break;
            case 'reps':
                getValue = (h) => h.max_reps || 0;
                break;
            case 'distance':
                getValue = (h) => h.max_distance || 0;
                break;
            case 'duration':
                getValue = (h) => h.max_duration || 0;
                break;
        }

        return data.map(h => {
            const d = new Date(h.date);
            const val = getValue(h);
            let displayVal = val.toString();

            if (selectedMetric === 'duration') {
                displayVal = formatDuration(val);
            } else if (selectedMetric === 'distance' || selectedMetric === 'weight') {
                displayVal = val.toFixed(2);
            }

            return {
                value: val,
                label: `${d.getDate()}/${d.getMonth() + 1}`,
                dataPointText: displayVal,
            };
        });
    }, [selectedMetric, data]);

    const stats = useMemo(() => {
        if (!processedData.length) return null;
        const values = processedData.map(d => d.value);
        const max = Math.max(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;

        const format = (val: number) => {
            if (selectedMetric === 'duration') return formatDuration(val);
            if (selectedMetric === 'distance') return `${val.toFixed(2)}m`;
            if (selectedMetric === 'weight') return `${val.toFixed(2)}kg`;
            return Math.round(val).toString();
        };

        return {
            max: format(max),
            avg: format(avg),
        };
    }, [processedData, selectedMetric]);

    const maxValue = processedData.length ? Math.max(...processedData.map(d => d.value)) : 0;

    const yAxisProps = (() => {
        if (maxValue === 0) return { noOfSections: 4, maxValue: 100 };

        if (maxValue <= 10) {
            return { noOfSections: maxValue, maxValue: maxValue, stepValue: 1 };
        }
        const sections = 4;
        let step = maxValue / sections;

        const magnitudes = [1, 2, 2.5, 5];
        let power = Math.pow(10, Math.floor(Math.log10(step)));
        let bestStep = power;

        for (const m of magnitudes) {
            if (m * power >= step) {
                bestStep = m * power;
                break;
            }
        }
        if (bestStep < step) bestStep = 10 * power;

        return {
            noOfSections: sections,
            maxValue: bestStep * sections,
            stepValue: bestStep
        };
    })();

    const renderToggle = (metric: Metric, label: string) => (
        <TouchableOpacity
            onPress={() => setSelectedMetric(metric)}
            style={[
                styles.toggleButton,
                selectedMetric === metric && [styles.toggleButtonActive, { backgroundColor: theme.primary }]
            ]}
        >
            <Text style={[
                styles.toggleText,
                { color: theme.textSecondary },
                selectedMetric === metric && styles.toggleTextActive
            ]}>{label}</Text>
        </TouchableOpacity>

    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>{t('progress')}</Text>
                <View style={[styles.toggleGroup, { backgroundColor: theme.background }]}>

                    {exercise.type === 'cardio' ? (
                        <>
                            {renderToggle('distance', t('meters'))}
                            {renderToggle('duration', t('time'))}
                        </>
                    ) : (exercise.type === 'bodyweight_timer' ? (
                        <>
                            {renderToggle('weight', t('weight'))}
                            {renderToggle('duration', t('time'))}
                        </>
                    ) : (
                        <>
                            {renderToggle('weight', t('weight'))}
                            {renderToggle('reps', t('reps'))}
                        </>
                    ))}
                </View>
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

                {graphWidth > 0 && processedData.length > 0 ? (() => {
                    const yAxisLabelWidth = 60;
                    const availableWidth = graphWidth - yAxisLabelWidth - 16;

                    const minSpacing = 60;
                    const initialSpacing = 30;
                    const endSpacing = 30;

                    let spacing = minSpacing;
                    if (processedData.length > 1) {
                        const fitSpacing = (availableWidth - initialSpacing - endSpacing) / (processedData.length - 1);
                        spacing = Math.max(minSpacing, fitSpacing);
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
                            formatYLabel={(val) => {
                                const numericVal = parseFloat(val);
                                if (selectedMetric === 'duration') return formatDuration(numericVal);
                                if (selectedMetric === 'distance' && numericVal >= 1000) return `${(numericVal / 1000).toFixed(2)}k`;
                                if (selectedMetric === 'reps') return Math.round(numericVal).toString();
                                return numericVal.toFixed(2);
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

                    );
                })() : (
                    <View style={styles.emptyState}>
                        <Text style={{ color: theme.textSecondary }}>{t('noHistoryData')}</Text>
                    </View>

                )}
            </View>
        </View>
    );
};

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
        padding: 2,
    },

    toggleButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    toggleButtonActive: {
    },
    toggleText: {
        fontSize: 12,
        fontWeight: '600',
    },

    toggleTextActive: {
        color: '#FFF',
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
        padding: 40,
        alignItems: 'center',
    }

});
