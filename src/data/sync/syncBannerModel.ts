import type { SyncStatusState } from './SyncStatus'

// What the SyncStatusBanner should show, distilled from the observable sync
// state plus the blocked-row count. `null` means render nothing.
export type SyncBannerModel = {
    variant: 'failed' | 'blocked'
    summary: string
}

// Pure mapping from sync state → banner display. Transient failures still being
// retried take precedence and get the prominent alert; rows that were given up
// on (blocked) are reported quietly, never both.
export const resolveSyncBanner = (state: SyncStatusState, blockedCount: number): SyncBannerModel | null => {
    if (state.kind === 'failed') {
        const firstReason = state.rows[0]?.reason
        const summary =
            state.rows.length === 1
                ? `Sync failed: ${firstReason?.message ?? firstReason?.kind ?? 'unknown error'}`
                : `${state.rows.length} rows failed to sync`
        return { variant: 'failed', summary }
    }

    if (blockedCount > 0) {
        const summary = blockedCount === 1 ? "1 item couldn't sync" : `${blockedCount} items couldn't sync`
        return { variant: 'blocked', summary }
    }

    return null
}
