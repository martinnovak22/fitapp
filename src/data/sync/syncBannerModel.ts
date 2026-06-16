import type { SyncStatusState } from './SyncStatus'

// What the SyncStatusBanner should show, distilled from the observable sync
// state plus the blocked-row count. `null` means render nothing.
export type SyncBannerModel = {
    variant: 'failed' | 'blocked'
    summary: string
}

// Pure mapping from the observable sync state plus the blocked-row count to a
// banner model. Transient failures (observable.kind === 'failed') take
// precedence and get the prominent alert; rows that were given up on (blocked)
// surface as a quiet indicator even when the observable is idle/running, never
// both at once.
export const resolveSyncBanner = (state: SyncStatusState, blockedCount: number): SyncBannerModel | null => {
    switch (state.kind) {
        case 'failed': {
            const firstReason = state.rows[0]?.reason
            const summary =
                state.rows.length === 1
                    ? `Sync failed: ${firstReason?.message ?? firstReason?.kind ?? 'unknown error'}`
                    : `${state.rows.length} rows failed to sync`
            return { variant: 'failed', summary }
        }
        case 'idle':
        case 'running':
            break
        default: {
            const _exhaustive: never = state
            return _exhaustive
        }
    }

    if (blockedCount > 0) {
        const summary = blockedCount === 1 ? "1 item couldn't sync" : `${blockedCount} items couldn't sync`
        return { variant: 'blocked', summary }
    }

    return null
}
