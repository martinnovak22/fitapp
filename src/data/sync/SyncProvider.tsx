import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AppState } from 'react-native'
import { getSyncState, runSync } from './syncService'
import { syncStatusStore, type SyncStatus as ObservableSyncStatus } from './SyncStatus'
import { useAuth } from '@/src/modules/auth/useAuth'
import { isRemoteDataMode } from '@/src/modules/auth/authMode'

type SyncBannerStatus = {
    isSyncing: boolean
    outboxSize: number
    lastSuccessAt: string | null
    lastAttemptAt: string | null
    lastError: string | null
    observable: ObservableSyncStatus
}

type SyncContextValue = {
    status: SyncBannerStatus
    refreshStatus: () => Promise<void>
    triggerSync: () => Promise<void>
}

const DEFAULT_STATUS: SyncBannerStatus = {
    isSyncing: false,
    outboxSize: 0,
    lastSuccessAt: null,
    lastAttemptAt: null,
    lastError: null,
    observable: { kind: 'idle' },
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined)

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [status, setStatus] = useState<SyncBannerStatus>(DEFAULT_STATUS)
    const { isAuthenticated, authMode } = useAuth()

    const refreshStatus = useCallback(async () => {
        const state = await getSyncState()
        setStatus((prev) => ({
            isSyncing: state.is_syncing === 1,
            outboxSize: state.outbox_size,
            lastSuccessAt: state.last_success_at,
            lastAttemptAt: state.last_attempt_at,
            lastError: state.last_error,
            observable: prev.observable,
        }))
    }, [])

    useEffect(() => {
        const unsubscribe = syncStatusStore.subscribe((observable) => {
            setStatus((prev) => ({ ...prev, observable }))
        })
        return unsubscribe
    }, [])

    const triggerSync = useCallback(async () => {
        // Errors are surfaced via the SyncStatus observable; no need to throw
        // up the React tree.
        await runSync()
        await refreshStatus()
    }, [refreshStatus])

    useEffect(() => {
        void refreshStatus()
    }, [refreshStatus])

    useEffect(() => {
        if (!isRemoteDataMode() || !isAuthenticated || authMode !== 'account') return

        void triggerSync()
        const intervalId = setInterval(() => {
            void triggerSync()
        }, 20_000)

        const appStateSub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                void triggerSync()
            }
        })

        return () => {
            clearInterval(intervalId)
            appStateSub.remove()
        }
    }, [authMode, isAuthenticated, triggerSync])

    useEffect(() => {
        if (!isRemoteDataMode() || authMode !== 'account' || !isAuthenticated) {
            setStatus(DEFAULT_STATUS)
            return
        }
        void refreshStatus()
    }, [authMode, isAuthenticated, refreshStatus])

    const value = useMemo<SyncContextValue>(
        () => ({
            status,
            refreshStatus,
            triggerSync,
        }),
        [refreshStatus, status, triggerSync]
    )

    return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export const useSync = () => {
    const context = useContext(SyncContext)
    if (!context) {
        throw new Error('useSync must be used inside SyncProvider.')
    }
    return context
}
