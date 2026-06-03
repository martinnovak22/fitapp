import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { getSyncState, retryBlockedRows, runSync } from './syncService'
import { syncStatusStore, type SyncStatus as ObservableSyncStatus } from './SyncStatus'
import { useAuth } from '@/src/modules/auth/useAuth'
import { isRemoteDataMode } from '@/src/modules/auth/authMode'

// Sync polling is the dominant background cost when the user is idle. Issue #26
// relaxes it from a 20s tick to a 60s base with exponential backoff up to 5min
// when consecutive cycles produce no work. AppState 'active' and explicit user
// retries reset the backoff so the next tick is prompt.
const SYNC_BASE_INTERVAL_MS = 60_000
const SYNC_MAX_INTERVAL_MS = 5 * 60_000

type SyncBannerStatus = {
    isSyncing: boolean
    outboxSize: number
    blockedCount: number
    lastSuccessAt: string | null
    lastAttemptAt: string | null
    lastError: string | null
    observable: ObservableSyncStatus
}

type SyncContextValue = {
    status: SyncBannerStatus
    refreshStatus: () => Promise<void>
    triggerSync: () => Promise<void>
    retryBlocked: () => Promise<void>
}

const DEFAULT_STATUS: SyncBannerStatus = {
    isSyncing: false,
    outboxSize: 0,
    blockedCount: 0,
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
            blockedCount: state.blocked_size,
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

    // Tracks consecutive idle cycles for backoff. A cycle is "idle" when it
    // pushed nothing AND pulled nothing AND wasn't skipped due to inactive
    // auth. Reset to 0 on any meaningful work, AppState 'active', or explicit
    // triggerSync from UI.
    const idleCyclesRef = useRef(0)
    const lastCycleWasIdleRef = useRef(false)

    const triggerSync = useCallback(async () => {
        // Errors are surfaced via the SyncStatus observable; no need to throw
        // up the React tree.
        const result = await runSync()
        await refreshStatus()
        const idle =
            !!result &&
            !result.skipped &&
            result.pushed === 0 &&
            result.pulled === 0 &&
            result.failed === 0 &&
            !result.aborted
        lastCycleWasIdleRef.current = idle
        if (idle) {
            idleCyclesRef.current += 1
        } else {
            idleCyclesRef.current = 0
        }
    }, [refreshStatus])

    // Un-park blocked rows and immediately attempt a sync. Backs the "Try
    // again" affordance on the quiet blocked-items note.
    const retryBlocked = useCallback(async () => {
        await retryBlockedRows()
        await triggerSync()
    }, [triggerSync])

    useEffect(() => {
        void refreshStatus()
    }, [refreshStatus])

    useEffect(() => {
        if (!isRemoteDataMode() || !isAuthenticated || authMode !== 'account') return

        idleCyclesRef.current = 0
        lastCycleWasIdleRef.current = false

        let timeoutId: ReturnType<typeof setTimeout> | null = null
        let cancelled = false

        const nextDelay = () => {
            // Exponential backoff: 60s, 120s, 240s, capped at 5min. Reset when
            // the last cycle did real work (handled in triggerSync).
            const exponent = Math.max(0, idleCyclesRef.current - 1)
            const delay = SYNC_BASE_INTERVAL_MS * 2 ** exponent
            return Math.min(delay, SYNC_MAX_INTERVAL_MS)
        }

        const schedule = () => {
            if (cancelled) return
            timeoutId = setTimeout(async () => {
                if (cancelled) return
                await triggerSync()
                schedule()
            }, nextDelay())
        }

        void triggerSync().then(schedule)

        const appStateSub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                // Reset backoff on foreground so the user sees prompt
                // up-to-date data when they return to the app.
                idleCyclesRef.current = 0
                if (timeoutId) clearTimeout(timeoutId)
                void triggerSync().then(schedule)
            }
        })

        return () => {
            cancelled = true
            if (timeoutId) clearTimeout(timeoutId)
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
            retryBlocked,
        }),
        [refreshStatus, status, triggerSync, retryBlocked]
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
