import type React from 'react'
import { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { Button } from '@/src/modules/core/components/Button'
import { Appear } from '@/src/modules/core/components/motion'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { useSync } from './SyncProvider'
import { resolveSyncBanner } from './syncBannerModel'

export const SyncStatusBanner: React.FC = () => {
    const { status, triggerSync, retryBlocked } = useSync()
    const { theme } = useTheme()
    const insets = useSafeAreaInsets()
    const handleRetry = useCallback(() => {
        void triggerSync()
    }, [triggerSync])

    const handleRetryBlocked = useCallback(() => {
        void retryBlocked()
    }, [retryBlocked])

    const banner = resolveSyncBanner(status.observable, status.blockedCount)
    if (!banner) return null

    const content =
        banner.variant === 'failed' ? (
            <View
                style={[styles.banner, { backgroundColor: theme.errorSurface, paddingTop: insets.top + Spacing.sm }]}
                accessibilityRole="alert"
            >
                <Typography.Label size="xs" style={[styles.message, { color: 'white' }]} numberOfLines={2}>
                    {banner.summary}
                </Typography.Label>
                <Button
                    label="Retry"
                    onPress={handleRetry}
                    accessibilityLabel="Retry sync"
                    variant="text"
                    size="sm"
                    style={styles.retry}
                    labelStyle={styles.retryText}
                />
            </View>
        ) : (
            <View
                style={[styles.banner, { backgroundColor: theme.surface, paddingTop: insets.top + Spacing.sm }]}
                accessibilityLiveRegion="polite"
            >
                <Typography.Label size="xs" style={[styles.message, { color: theme.textSecondary }]} numberOfLines={2}>
                    {banner.summary}
                </Typography.Label>
                <Button
                    label="Try again"
                    onPress={handleRetryBlocked}
                    accessibilityLabel="Retry items that couldn't sync"
                    variant="text"
                    size="sm"
                    labelStyle={{ color: theme.primary }}
                />
            </View>
        )

    // Appear owns the fixed positioning so the banner fades in/out (and swaps
    // between failed/blocked via the key) instead of popping.
    return (
        <Appear key={banner.variant} variant="fade" style={styles.bannerContainer}>
            {content}
        </Appear>
    )
}

const styles = StyleSheet.create({
    bannerContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        elevation: 10,
    },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
        gap: Spacing.sm,
    },
    message: {
        flex: 1,
    },
    retry: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: Radius.sm,
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    retryText: {
        color: 'white',
    },
})
