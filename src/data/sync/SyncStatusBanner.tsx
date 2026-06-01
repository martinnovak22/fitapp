import { Radius } from '@/src/constants/Radius'
import { Button } from '@/src/modules/core/components/Button'
import { Typography } from '@/src/modules/core/components/Typography'
import React, { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSync } from './SyncProvider'

export const SyncStatusBanner: React.FC = () => {
    const { status, triggerSync } = useSync()
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
        <View style={styles.banner} accessibilityRole="alert">
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
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#B0382F',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 12,
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
