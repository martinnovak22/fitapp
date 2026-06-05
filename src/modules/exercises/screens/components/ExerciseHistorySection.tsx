import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import type { Exercise } from '@/src/db/exercises'
import { Button } from '@/src/modules/core/components/Button'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { Appear } from '@/src/modules/core/components/motion'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import type { BestSetEntry, SessionSummary } from '@/src/modules/exercises/ExerciseStats'
import type { PrimaryMetric } from '@/src/modules/exercises/ExerciseTypeMetadata'
import { ExerciseHistoryGraph } from './ExerciseHistoryGraph'

interface ExerciseHistorySectionProps {
    exercise: Exercise
    historyData: BestSetEntry[]
    historySummary: SessionSummary | null
    dominantMetric: PrimaryMetric | null
    historyLoading: boolean
    historyError: string | null
    onRetry: () => void
}

// The history slot of the detail card: loading, error, the graph, or an empty
// state — each entering through the shared Appear wrapper with a stable key.
export function ExerciseHistorySection({
    exercise,
    historyData,
    historySummary,
    dominantMetric,
    historyLoading,
    historyError,
    onRetry,
}: ExerciseHistorySectionProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()

    if (historyLoading) {
        return (
            <Appear key="loading" style={styles.historyLoading}>
                <ActivityIndicator size={'small'} color={theme.primary} />
                <Typography.Meta style={styles.loadingText}>{t('loading')}</Typography.Meta>
            </Appear>
        )
    }

    if (historyError) {
        return (
            <Appear key="error" style={styles.historyError}>
                <EmptyState message={historyError} icon={'line-chart'} style={{ backgroundColor: theme.surface }} />
                <Button
                    label={t('retry')}
                    onPress={onRetry}
                    variant={'outline'}
                    style={styles.retryButton}
                    accessibilityHint={t('failedToLoadHistory')}
                />
            </Appear>
        )
    }

    if (historyData.length > 0) {
        return (
            <Appear key="graph">
                <ExerciseHistoryGraph
                    exercise={exercise}
                    data={historyData}
                    summary={historySummary}
                    dominantMetric={dominantMetric}
                />
            </Appear>
        )
    }

    return (
        <Appear key="empty">
            <EmptyState message={t('statsComingSoon')} icon={'line-chart'} style={{ backgroundColor: theme.surface }} />
        </Appear>
    )
}

const styles = StyleSheet.create({
    historyLoading: {
        marginTop: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        minHeight: 120,
    },
    historyError: {
        marginTop: Spacing.md,
    },
    retryButton: {
        marginTop: Spacing.md,
    },
    loadingText: {
        marginTop: Spacing.xs,
    },
})
