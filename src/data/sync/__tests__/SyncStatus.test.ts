import { describe, expect, it, vi } from 'vitest'
import { createSyncStatusStore } from '../SyncStatus'

describe('SyncStatus observable store', () => {
    it('starts idle and transitions through running → failed → running → idle', () => {
        const store = createSyncStatusStore()
        const seen: string[] = []
        store.subscribe((s) => seen.push(s.kind))

        expect(store.get().kind).toBe('idle')

        store.set({ kind: 'running' })
        store.set({
            kind: 'failed',
            rows: [
                {
                    entityType: 'exercise',
                    uuid: 'ex-1',
                    reason: { kind: 'network-error', message: 'down' },
                },
            ],
            lastAttemptAt: '2026-01-01T00:00:00Z',
        })
        store.set({ kind: 'running' })
        store.set({ kind: 'idle' })

        expect(seen).toEqual(['running', 'failed', 'running', 'idle'])
        expect(store.get().kind).toBe('idle')
    })

    it('unsubscribe stops further notifications', () => {
        const store = createSyncStatusStore()
        const listener = vi.fn()
        const off = store.subscribe(listener)
        store.set({ kind: 'running' })
        off()
        store.set({ kind: 'idle' })
        expect(listener).toHaveBeenCalledTimes(1)
    })
})
