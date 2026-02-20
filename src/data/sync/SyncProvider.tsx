import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AppState } from 'react-native'
import { getSyncState, runSync } from './syncService'
import { useAuth } from '@/src/modules/auth/useAuth'
import { isRemoteDataMode } from '@/src/modules/auth/authMode'

type SyncStatus = {
    isSyncing: boolean
    outboxSize: number
    lastSuccessAt: string | null
    lastAttemptAt: string | null
    lastError: string | null
}

type SyncContextValue = {
    status: SyncStatus
    refreshStatus: () => Promise<void>
    triggerSync: () => Promise<void>
}

const DEFAULT_STATUS: SyncStatus = {
    isSyncing: false,
    outboxSize: 0,
    lastSuccessAt: null,
    lastAttemptAt: null,
    lastError: null,
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined)

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [status, setStatus] = useState<SyncStatus>(DEFAULT_STATUS)
    const { isAuthenticated, authMode } = useAuth()

    const refreshStatus = useCallback(async () => {
        const state = await getSyncState()
        setStatus({
            isSyncing: state.is_syncing === 1,
            outboxSize: state.outbox_size,
            lastSuccessAt: state.last_success_at,
            lastAttemptAt: state.last_attempt_at,
            lastError: state.last_error,
        })
    }, [])

    const triggerSync = useCallback(async () => {
        try {
            await runSync()
        } catch (error) {
            console.warn('[sync] run failed', error)
        } finally {
            await refreshStatus()
        }
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
