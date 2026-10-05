import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { SkeletonBlock, SkeletonPulse } from '@/src/modules/core/components/Skeleton'
import { useTheme } from '@/src/modules/core/hooks/useTheme'

// The Workout tab's shape while it loads: start button, Template rows, week strip,
// last-workout row.
export function WorkoutDashboardSkeleton() {
    const { theme } = useTheme()
    const { t } = useTranslation()

    return (
        <SkeletonPulse>
            <View style={styles.stack} accessibilityRole="progressbar" accessibilityLabel={t('loading')} aria-busy>
                <SkeletonBlock width="100%" height={48} borderRadius={Radius.sm} />

                <View style={styles.section}>
                    <View style={styles.inset}>
                        <SkeletonBlock width={110} height={14} borderRadius={2} />
                    </View>
                    <View style={[styles.group, { backgroundColor: theme.surface }]}>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <View
                                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                                key={i}
                                style={styles.row}
                            >
                                <SkeletonBlock width="45%" height={16} />
                                <SkeletonBlock width="65%" height={12} borderRadius={2} />
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.inset}>
                        <SkeletonBlock width={80} height={14} borderRadius={2} />
                    </View>
                    <View style={[styles.group, styles.week, { backgroundColor: theme.surface }]}>
                        <View style={styles.weekRow}>
                            {Array.from({ length: 7 }).map((_, i) => (
                                <SkeletonBlock
                                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                                    key={i}
                                    width={28}
                                    height={28}
                                    borderRadius={Radius.pill}
                                />
                            ))}
                        </View>
                        <SkeletonBlock width="50%" height={14} borderRadius={2} />
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.inset}>
                        <SkeletonBlock width={90} height={14} borderRadius={2} />
                    </View>
                    <View style={[styles.group, { backgroundColor: theme.surface }]}>
                        <View style={styles.row}>
                            <SkeletonBlock width="55%" height={16} />
                            <SkeletonBlock width="70%" height={12} borderRadius={2} />
                        </View>
                    </View>
                </View>
            </View>
        </SkeletonPulse>
    )
}

const styles = StyleSheet.create({
    stack: {
        gap: Spacing.lg,
    },
    section: {
        gap: Spacing.sm,
    },
    inset: {
        paddingLeft: Spacing.md,
    },
    group: {
        borderRadius: Radius.md,
        overflow: 'hidden',
    },
    row: {
        gap: Spacing.xs,
        padding: Spacing.md,
    },
    week: {
        padding: Spacing.md,
        gap: Spacing.sm + Spacing.xs,
    },
    weekRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
})
