import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { Card } from '@/src/modules/core/components/Card'
import { SkeletonBlock, SkeletonPulse } from '@/src/modules/core/components/Skeleton'
import { useTheme } from '@/src/modules/core/hooks/useTheme'

export function WorkoutDashboardSkeleton() {
    const { theme } = useTheme()
    const { t } = useTranslation()

    return (
        <SkeletonPulse>
            <View accessibilityRole="progressbar" accessibilityLabel={t('loading')} aria-busy>
                <Card>
                    <SkeletonBlock width={80} height={18} />
                    <View style={skeletonStyles.weekRow}>
                        {Array.from({ length: 7 }).map((_, i) => (
                            <View
                                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                                key={i}
                                style={skeletonStyles.dayCol}
                            >
                                <SkeletonBlock width={28} height={28} borderRadius={Radius.sm} />
                                <SkeletonBlock
                                    width={14}
                                    height={10}
                                    borderRadius={2}
                                    style={{ marginTop: Spacing.sm }}
                                />
                            </View>
                        ))}
                    </View>
                    <View style={[skeletonStyles.divider, { backgroundColor: theme.hairline }]} />
                    <View style={skeletonStyles.statsRow}>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <View
                                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                                key={i}
                                style={skeletonStyles.statItem}
                            >
                                <SkeletonBlock width={54} height={22} />
                                <SkeletonBlock
                                    width={40}
                                    height={11}
                                    borderRadius={2}
                                    style={{ marginTop: Spacing.xs }}
                                />
                            </View>
                        ))}
                    </View>
                </Card>

                <Card>
                    <SkeletonBlock width="55%" height={18} />
                    <SkeletonBlock width="45%" height={14} style={{ marginTop: Spacing.md }} />
                    <SkeletonBlock
                        width="100%"
                        height={48}
                        borderRadius={Radius.md}
                        style={{ marginTop: Spacing.md }}
                    />
                </Card>

                <Card>
                    <SkeletonBlock width={90} height={18} />
                    <SkeletonBlock width="70%" height={16} style={{ marginTop: Spacing.md }} />
                    <View style={skeletonStyles.metaRow}>
                        <SkeletonBlock width={70} height={14} borderRadius={2} />
                        <SkeletonBlock width={65} height={14} borderRadius={2} />
                    </View>
                    <View style={skeletonStyles.chipRow}>
                        <SkeletonBlock width={65} height={24} borderRadius={Radius.pill} />
                        <SkeletonBlock width={80} height={24} borderRadius={Radius.pill} />
                        <SkeletonBlock width={55} height={24} borderRadius={Radius.pill} />
                    </View>
                    <View
                        style={[skeletonStyles.divider, { backgroundColor: theme.hairline, marginTop: Spacing.md }]}
                    />
                    <SkeletonBlock width="100%" height={18} />
                    <SkeletonBlock width="100%" height={18} style={{ marginTop: Spacing.md }} />
                </Card>

                <Card>
                    <SkeletonBlock width={110} height={18} />
                    {Array.from({ length: 4 }).map((_, i) => (
                        <View
                            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                            key={i}
                            style={skeletonStyles.balanceRow}
                        >
                            <SkeletonBlock width={80} height={13} borderRadius={2} />
                            <View style={skeletonStyles.balanceTrack}>
                                <SkeletonBlock width="100%" height={6} borderRadius={3} />
                            </View>
                            <SkeletonBlock width={24} height={13} borderRadius={2} />
                        </View>
                    ))}
                </Card>
            </View>
        </SkeletonPulse>
    )
}

const skeletonStyles = StyleSheet.create({
    weekRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: Spacing.xs,
        marginTop: Spacing.md,
        marginBottom: Spacing.lg,
    },
    dayCol: {
        alignItems: 'center',
        flex: 1,
    },
    divider: {
        height: 1,
        marginBottom: Spacing.md,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    metaRow: {
        flexDirection: 'row',
        columnGap: Spacing.lg,
        marginTop: Spacing.md,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
        marginTop: Spacing.md,
    },
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: Spacing.sm,
        marginTop: Spacing.md,
    },
    balanceTrack: {
        flex: 1,
    },
})
