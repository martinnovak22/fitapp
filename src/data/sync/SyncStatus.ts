// Observable state machine for the sync-status UI banner.
// states: idle → running → idle (clean run) or running → failed (push failures)
// failed → running → idle on retry.

import type { OutboxEntityType, SyncFailureReason } from './Outbox'

export type SyncFailure = {
    entityType: OutboxEntityType | 'tombstone'
    uuid: string
    reason: SyncFailureReason
}

export type SyncStatusState =
    | { kind: 'idle' }
    | { kind: 'running' }
    | { kind: 'failed'; rows: SyncFailure[]; lastAttemptAt: string }

export type SyncStatusListener = (status: SyncStatusState) => void

export type SyncStatusStore = {
    get(): SyncStatusState
    set(next: SyncStatusState): void
    subscribe(listener: SyncStatusListener): () => void
}

export const createSyncStatusStore = (initial: SyncStatusState = { kind: 'idle' }): SyncStatusStore => {
    let current: SyncStatusState = initial
    const listeners = new Set<SyncStatusListener>()
    return {
        get: () => current,
        set: (next) => {
            current = next
            for (const fn of listeners) fn(current)
        },
        subscribe: (listener) => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
    }
}

// Single app-wide instance. Tests create their own via createSyncStatusStore.
export const syncStatusStore: SyncStatusStore = createSyncStatusStore()
