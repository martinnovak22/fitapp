// Observable state machine for the sync-status UI banner.
// states: idle → running → idle (clean run) or running → failed (push failures)
// failed → running → idle on retry.

import type { OutboxEntityType, SyncFailureReason } from './Outbox'

export type SyncFailure = {
    entityType: OutboxEntityType | 'tombstone'
    uuid: string
    reason: SyncFailureReason
}

export type SyncStatus =
    | { kind: 'idle' }
    | { kind: 'running' }
    | { kind: 'failed'; rows: SyncFailure[]; lastAttemptAt: string }

export type SyncStatusListener = (status: SyncStatus) => void

export type SyncStatusStore = {
    get(): SyncStatus
    set(next: SyncStatus): void
    subscribe(listener: SyncStatusListener): () => void
}

export const createSyncStatusStore = (initial: SyncStatus = { kind: 'idle' }): SyncStatusStore => {
    let current: SyncStatus = initial
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
