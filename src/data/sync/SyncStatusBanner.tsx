import React, { useCallback } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
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
            <Text style={styles.message} numberOfLines={2}>
                {summary}
            </Text>
            <Pressable
                onPress={handleRetry}
                accessibilityRole="button"
                accessibilityLabel="Retry sync"
                style={styles.retry}
            >
                <Text style={styles.retryText}>Retry</Text>
            </Pressable>
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
        fontSize: 13,
        fontWeight: '500',
    },
    retry: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    retryText: {
        color: 'white',
        fontSize: 13,
        fontWeight: '600',
    },
})
