import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { SkeletonBlock, SkeletonPulse } from '@/src/modules/core/components/Skeleton'
import { useTheme } from '@/src/modules/core/hooks/useTheme'

const SKELETON_ROW_COUNT = 6

// The history list's shape while it loads: view switcher, a month header and
// grouped workout rows with their three lines.
export function HistoryListSkeleton() {
    const { t } = useTranslation()
    const { theme } = useTheme()

    return (
        <SkeletonPulse>
            <View style={styles.root} accessibilityRole="progressbar" accessibilityLabel={t('loading')} aria-busy>
                <SkeletonBlock width="100%" height={48} borderRadius={Radius.sm} />
                <View style={styles.header}>
                    <SkeletonBlock width={140} height={14} borderRadius={2} />
                </View>
                <View style={[styles.group, { backgroundColor: theme.surface }]}>
                    {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
                        <View
                            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                            key={i}
                            style={styles.row}
                        >
                            <SkeletonBlock width="40%" height={16} />
                            <SkeletonBlock width="70%" height={13} borderRadius={2} />
                            <SkeletonBlock width="55%" height={12} borderRadius={2} />
                        </View>
                    ))}
                </View>
            </View>
        </SkeletonPulse>
    )
}

const styles = StyleSheet.create({
    root: {
        gap: Spacing.sm,
    },
    header: {
        paddingLeft: Spacing.md,
        paddingTop: Spacing.sm,
    },
    group: {
        borderRadius: Radius.md,
        overflow: 'hidden',
    },
    row: {
        gap: Spacing.xs,
        padding: Spacing.md,
        minHeight: 64,
    },
})
