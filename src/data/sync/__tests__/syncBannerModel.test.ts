import { describe, expect, it } from 'vitest'
import type { SyncFailureReason } from '../Outbox'
import type { SyncStatusState } from '../SyncStatus'
import { resolveSyncBanner } from '../syncBannerModel'

const failed = (reasons: { kind: string; message: string }[]): SyncStatusState => ({
    kind: 'failed',
    lastAttemptAt: '2026-01-01T00:00:00.000Z',
    rows: reasons.map((reason) => ({
        entityType: 'exercise',
        uuid: 'u',
        reason: reason as SyncFailureReason,
    })),
})

describe('resolveSyncBanner', () => {
    it('returns null when idle and nothing is blocked', () => {
        expect(resolveSyncBanner({ kind: 'idle' }, 0)).toBeNull()
    })

    it('returns null while running with nothing blocked', () => {
        expect(resolveSyncBanner({ kind: 'running' }, 0)).toBeNull()
    })

    it('reports a failure with the first row reason message for a single failed row', () => {
        const state = failed([{ kind: 'network', message: 'offline' }])
        expect(resolveSyncBanner(state, 0)).toEqual({ variant: 'failed', summary: 'Sync failed: offline' })
    })

    it('keeps an empty message verbatim rather than substituting the kind', () => {
        const state = failed([{ kind: 'conflict', message: '' }])
        expect(resolveSyncBanner(state, 0)).toEqual({ variant: 'failed', summary: 'Sync failed: ' })
    })

    it('falls back to "unknown error" when a single failed row has no usable reason', () => {
        const state = {
            kind: 'failed',
            lastAttemptAt: 't',
            rows: [{ entityType: 'exercise', uuid: 'u' }],
        } as SyncStatusState
        expect(resolveSyncBanner(state, 0)).toEqual({ variant: 'failed', summary: 'Sync failed: unknown error' })
    })

    it('summarizes the count when multiple rows fail', () => {
        const state = failed([
            { kind: 'network', message: 'a' },
            { kind: 'network', message: 'b' },
        ])
        expect(resolveSyncBanner(state, 0)).toEqual({ variant: 'failed', summary: '2 rows failed to sync' })
    })

    it('prefers the failed banner over blocked items', () => {
        const state = failed([{ kind: 'network', message: 'a' }])
        expect(resolveSyncBanner(state, 5)).toEqual({ variant: 'failed', summary: 'Sync failed: a' })
    })

    it('reports a single blocked item when not failing', () => {
        expect(resolveSyncBanner({ kind: 'idle' }, 1)).toEqual({ variant: 'blocked', summary: "1 item couldn't sync" })
    })

    it('reports the blocked count when more than one item is blocked', () => {
        expect(resolveSyncBanner({ kind: 'idle' }, 3)).toEqual({ variant: 'blocked', summary: "3 items couldn't sync" })
    })
})
