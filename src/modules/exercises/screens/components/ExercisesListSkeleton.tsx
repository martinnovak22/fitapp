import { ScrollView, StyleSheet, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { SkeletonBlock } from '@/src/modules/core/components/Skeleton'
import { useTheme } from '@/src/modules/core/hooks/useTheme'

const SKELETON_ROW_COUNT = 8

export function ExercisesListSkeleton() {
    const { theme } = useTheme()

    return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
            {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
                <View
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                    key={i}
                    style={[skeletonStyles.cardInner, { backgroundColor: theme.card, borderColor: theme.border }]}
                >
                    <SkeletonBlock width={44} height={44} borderRadius={Radius.sm} />
                    <View style={skeletonStyles.content}>
                        <SkeletonBlock width="65%" height={16} borderRadius={2} />
                        <SkeletonBlock width="45%" height={13} borderRadius={2} style={{ marginTop: Spacing.xs }} />
                    </View>
                    <SkeletonBlock width={20} height={20} borderRadius={4} />
                </View>
            ))}
        </ScrollView>
    )
}

const skeletonStyles = StyleSheet.create({
    cardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm + Spacing.xs,
        paddingHorizontal: Spacing.md,
        borderRadius: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        minHeight: 56,
    },
    content: {
        flex: 1,
        marginLeft: Spacing.md,
        marginRight: Spacing.md,
    },
})
