import { Theme } from '@/src/constants/Colors';
import { Exercise } from '@/src/db/exercises';
import { formatDuration } from '@/src/utils/formatters';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from "react-native-gifted-charts";

interface ExerciseHistoryGraphProps {
    exercise: Exercise;
    data: any[]; // Raw history data
}

type Metric = 'weight' | 'reps' | 'distance' | 'duration';

export const ExerciseHistoryGraph = ({ exercise, data }: ExerciseHistoryGraphProps) => {
    const [selectedMetric, setSelectedMetric] = useState<Metric>('weight');
    const [graphWidth, setGraphWidth] = useState(0);

    // Set default metric based on exercise type
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
            } else if (selectedMetric === 'distance') {
                displayVal = Math.round(val).toString();
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
            if (selectedMetric === 'distance') return `${Math.round(val)}m`;
            if (selectedMetric === 'weight') return `${val}kg`;
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
        if (maxValue <= 10 && Number.isInteger(maxValue)) {
            return { noOfSections: maxValue, maxValue: maxValue, stepValue: 1 };
        }
        const sections = 4;
        const roundedMax = Math.ceil(maxValue / sections) * sections;
        return { noOfSections: sections, maxValue: roundedMax };
    })();

    const renderToggle = (metric: Metric, label: string) => (
        <TouchableOpacity
            onPress={() => setSelectedMetric(metric)}
            style={[
                styles.toggleButton,
                selectedMetric === metric && styles.toggleButtonActive
            ]}
        >
            <Text style={[
                styles.toggleText,
                selectedMetric === metric && styles.toggleTextActive
            ]}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Progress</Text>
                <View style={styles.toggleGroup}>
                    {exercise.type === 'cardio' ? (
                        <>
                            {renderToggle('distance', 'Meters')}
                            {renderToggle('duration', 'Time')}
                        </>
                    ) : (exercise.type === 'bodyweight_timer' ? (
                        <>
                            {renderToggle('weight', 'Weight')}
                            {renderToggle('duration', 'Time')}
                        </>
                    ) : (
                        <>
                            {renderToggle('weight', 'Weight')}
                            {renderToggle('reps', 'Reps')}
                        </>
                    ))}
                </View>
            </View>

            {stats && (
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Personal Best</Text>
                        <Text style={styles.statValue}>{stats.max}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Average</Text>
                        <Text style={styles.statValue}>{stats.avg}</Text>
                    </View>
                </View>
            )}

            <View
                onLayout={(e) => setGraphWidth(e.nativeEvent.layout.width)}
                style={styles.graphWrapper}
            >
                {graphWidth > 0 && processedData.length > 0 ? (
                    <LineChart
                        data={processedData}
                        color={Theme.primary}
                        thickness={3}
                        dataPointsColor={Theme.primary}
                        xAxisColor={Theme.border}
                        yAxisColor={Theme.border}
                        yAxisTextStyle={styles.axisText}
                        xAxisLabelTextStyle={styles.axisText}
                        noOfSections={yAxisProps.noOfSections}
                        stepValue={yAxisProps.stepValue}
                        maxValue={yAxisProps.maxValue}
                        areaChart
                        startFillColor={Theme.primary}
                        endFillColor={Theme.primary}
                        startOpacity={0.2}
                        endOpacity={0.01}
                        spacing={70}
                        initialSpacing={20}
                        curved
                        width={graphWidth - 40}
                        isAnimated
                        formatYLabel={(val) => {
                            if (selectedMetric === 'duration') return formatDuration(parseFloat(val));
                            return val;
                        }}
                        pointerConfig={{
                            activatePointersOnLongPress: true,
                            pointerStripUptoDataPoint: true,
                            pointerStripColor: Theme.primary,
                            pointerStripWidth: 2,
                            strokeDashArray: [2, 5],
                            pointerColor: Theme.primary,
                            radius: 5,
                            pointerLabelComponent: (items: any) => {
                                const val = items[0].value;
                                let display = val.toString();
                                if (selectedMetric === 'duration') display = formatDuration(val);
                                else if (selectedMetric === 'distance') display = `${val}m`;
                                else if (selectedMetric === 'weight') display = `${val}kg`;

                                return (
                                    <View style={styles.tooltip}>
                                        <Text style={styles.tooltipText}>{display}</Text>
                                        <Text style={styles.tooltipDate}>{items[0].label}</Text>
                                    </View>
                                );
                            },
                        }}
                    />
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={{ color: Theme.textSecondary }}>No history data available</Text>
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 24,
        backgroundColor: Theme.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: Theme.border,
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
        color: Theme.text,
    },
    toggleGroup: {
        flexDirection: 'row',
        backgroundColor: Theme.background,
        borderRadius: 10,
        padding: 2,
    },
    toggleButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    toggleButtonActive: {
        backgroundColor: Theme.primary,
    },
    toggleText: {
        fontSize: 12,
        fontWeight: '600',
        color: Theme.textSecondary,
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
        backgroundColor: Theme.background,
        padding: 12,
        borderRadius: 12,
    },
    statLabel: {
        fontSize: 12,
        color: Theme.textSecondary,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        color: Theme.text,
    },
    graphWrapper: {
        width: '100%',
        paddingBottom: 10,
        paddingLeft: 0,
        overflow: 'hidden',
    },
    axisText: {
        color: Theme.textSecondary,
        fontSize: 10,
    },
    tooltip: {
        backgroundColor: Theme.surface,
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Theme.primary,
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
        // Lift tooltip above point
        transform: [{ translateY: -40 }, { translateX: -30 }]
    },
    tooltipText: {
        color: Theme.text,
        fontSize: 12,
        fontWeight: 'bold',
    },
    tooltipDate: {
        color: Theme.textSecondary,
        fontSize: 10,
        marginTop: 2,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    }
});
