import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { Button } from '@/src/modules/core/components/Button'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import React, { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSync } from './SyncProvider'

export const SyncStatusBanner: React.FC = () => {
    const { status, triggerSync } = useSync()
    const { theme } = useTheme()
    const insets = useSafeAreaInsets()
    const observable = status.observable

    const handleRetry = useCallback(() => {
        void triggerSync()
    }, [triggerSync])

    if (observable.kind !== 'failed') return null

    const firstReason = observable.rows[0]?.reason
    const summary =
        observable.rows.length === 1
            ? `Sync failed: ${firstReason?.message ?? firstReason?.kind ?? 'unknown error'}`
            : `${observable.rows.length} rows failed to sync`

    return (
        <View
            style={[
                styles.banner,
                { backgroundColor: theme.errorSurface, paddingTop: insets.top + Spacing.sm },
            ]}
            accessibilityRole="alert"
        >
            <Typography.Label size="xs" style={styles.message} numberOfLines={2}>
                {summary}
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
    )
}

const styles = StyleSheet.create({
    banner: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        elevation: 10,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
        gap: Spacing.sm,
    },
    message: {
        flex: 1,
        color: 'white',
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
