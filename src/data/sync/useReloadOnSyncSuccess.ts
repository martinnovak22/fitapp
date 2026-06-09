import { useEffect, useRef } from 'react'
import { useSync } from './SyncProvider'

/**
 * Screens read from the local SQLite DB once when they gain focus. A background
 * sync that pulls fresh rows writes straight to SQLite without notifying React,
 * so right after login (when the local DB is still empty) the screen keeps
 * showing stale/empty data until the user pulls to refresh.
 *
 * This bridges that gap: `reload` is invoked whenever a sync cycle reports a
 * new success timestamp. The first observed value is captured without firing,
 * so it never double-loads on top of the focus-effect's initial read.
 */
export const useReloadOnSyncSuccess = (reload: () => void) => {
    const { status } = useSync()
    const lastSeenRef = useRef(status.lastSuccessAt)

    useEffect(() => {
        if (status.lastSuccessAt && status.lastSuccessAt !== lastSeenRef.current) {
            lastSeenRef.current = status.lastSuccessAt
            reload()
        }
    }, [status.lastSuccessAt, reload])
}
