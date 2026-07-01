import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { Card } from '@/src/modules/core/components/Card'
import { SkeletonBlock } from '@/src/modules/core/components/Skeleton'

const SKELETON_ROW_COUNT = 8

// Mirrors WorkoutHistoryCard's shape (date line, shorter time line, trailing
// status icon) without the optional note line, since not every real row has
// one and a skeleton should approximate the common case, not every case.
export function HistoryListSkeleton() {
    const { t } = useTranslation()

    return (
        <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listPadding}
            accessibilityRole="progressbar"
            accessibilityLabel={t('loading')}
            aria-busy
        >
            {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
                <Card
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                    key={i}
                    style={styles.workoutCard}
                >
                    <View style={styles.workoutItem}>
                        <View style={styles.workoutInfo}>
                            <SkeletonBlock width="70%" height={16} borderRadius={2} />
                            <SkeletonBlock width="35%" height={13} borderRadius={2} style={styles.timeBlock} />
                        </View>
                        <SkeletonBlock width={20} height={20} borderRadius={Radius.sm} />
                    </View>
                </Card>
            ))}
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    listPadding: {
        paddingBottom: Spacing.lg,
    },
    workoutItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 56,
    },
    workoutCard: {
        paddingVertical: Spacing.sm - Spacing.xs2,
        paddingHorizontal: Spacing.md,
    },
    workoutInfo: {
        flex: 1,
        paddingRight: Spacing.md,
    },
    timeBlock: {
        marginTop: Spacing.xs,
    },
})
