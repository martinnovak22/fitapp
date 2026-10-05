import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { SkeletonBlock, SkeletonPulse } from '@/src/modules/core/components/Skeleton'
import { useTheme } from '@/src/modules/core/hooks/useTheme'

const SKELETON_ROW_COUNT = 8

// The library's shape while it loads: search, filter chips, grouped rows.
export function ExercisesListSkeleton() {
    const { theme } = useTheme()
    const { t } = useTranslation()

    return (
        <SkeletonPulse>
            <View style={styles.root} accessibilityRole="progressbar" accessibilityLabel={t('loading')} aria-busy>
                <View style={styles.controls}>
                    <SkeletonBlock width="100%" height={44} borderRadius={Radius.sm} />
                    <View style={styles.chips}>
                        <SkeletonBlock width={88} height={36} borderRadius={Radius.pill} />
                        <SkeletonBlock width={112} height={36} borderRadius={Radius.pill} />
                    </View>
                </View>
                <View style={[styles.group, { backgroundColor: theme.surface }]}>
                    {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
                        <View
                            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                            key={i}
                            style={styles.row}
                        >
                            <SkeletonBlock width={40} height={40} borderRadius={Radius.sm} />
                            <View style={styles.text}>
                                <SkeletonBlock width="60%" height={16} />
                                <SkeletonBlock width="40%" height={12} borderRadius={2} />
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </SkeletonPulse>
    )
}

const styles = StyleSheet.create({
    root: {
        gap: Spacing.md,
    },
    controls: {
        gap: Spacing.sm + Spacing.xs,
    },
    chips: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    group: {
        borderRadius: Radius.md,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm + Spacing.xs,
        paddingHorizontal: Spacing.md,
        minHeight: 64,
    },
    text: {
        flex: 1,
        gap: Spacing.xs,
    },
})
