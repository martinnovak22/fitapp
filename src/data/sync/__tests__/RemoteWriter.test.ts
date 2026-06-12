import { describe, expect, it } from 'vitest'
import { createFakeSupabaseAdapter } from '@/src/test/fakeSupabase'
import { RemoteRequestError } from '../RemoteAdapter'
import { createRemoteWriter } from '../RemoteWriter'

describe('RemoteWriter', () => {
    it('reports persisted with the server-assigned id when the upsert is confirmed', async () => {
        const adapter = createFakeSupabaseAdapter()
        const writer = createRemoteWriter(adapter)

        const results = await writer.upsert('exercises', [
            { uuid: 'ex-1', user_id: 'u', name: 'Bench' },
            { uuid: 'ex-2', user_id: 'u', name: 'Squat' },
        ])

        expect(results.every((r) => r.kind === 'persisted')).toBe(true)
        expect(results.map((r) => r.uuid)).toEqual(['ex-1', 'ex-2'])
        for (const r of results) if (r.kind === 'persisted') expect(r.id).toBeGreaterThan(0)
    })

    it('does NOT ack when the server returns an empty body after upsert', async () => {
        const adapter = createFakeSupabaseAdapter()
        const writer = createRemoteWriter(adapter)

        adapter.queueFailure({ kind: 'empty-after-upsert' })
        const results = await writer.upsert('exercises', [{ uuid: 'ex-1', user_id: 'u', name: 'Bench' }])

        expect(results).toHaveLength(1)
        expect(results[0].kind).toBe('failed')
        if (results[0].kind === 'failed') {
            expect(results[0].reason.kind).toBe('remote-rejection')
            expect(results[0].reason.message).toMatch(/did not confirm/i)
        }
        // The dangerous bit: nothing was actually persisted, so the caller
        // would have falsely acked the local row without RemoteWriter's check.
        expect(adapter.snapshot('exercises')).toHaveLength(0)
    })

    it('reports a structured network-error failure when the adapter throws', async () => {
        const adapter = createFakeSupabaseAdapter()
        const writer = createRemoteWriter(adapter)

        adapter.queueFailure({ kind: 'network-error', message: 'connection reset' })
        const results = await writer.upsert('workouts', [
            { uuid: 'wk-1', user_id: 'u', date: '2026-01-01' },
            { uuid: 'wk-2', user_id: 'u', date: '2026-01-02' },
        ])

        expect(results).toHaveLength(2)
        for (const r of results) {
            expect(r.kind).toBe('failed')
            if (r.kind === 'failed') expect(r.reason.kind).toBe('network-error')
        }
    })

    // Pins that an oversized payload (HTTP 413) is a permanent rejection: the
    // outbox parks it as blocked on the first failure instead of retrying.
    it('classifies an HTTP 413 payload-too-large as a permanent rejection', async () => {
        const adapter = createFakeSupabaseAdapter()
        adapter.upsert = async () => {
            throw new RemoteRequestError('Sync request failed (sets): 413 Payload Too Large', 413)
        }
        const writer = createRemoteWriter(adapter)

        const results = await writer.upsert('sets', [{ uuid: 'set-1', user_id: 'u' }])

        expect(results).toHaveLength(1)
        expect(results[0].kind).toBe('failed')
        if (results[0].kind === 'failed') {
            expect(results[0].reason.kind).toBe('permanent-rejection')
            expect(results[0].reason.message).toMatch(/413/)
        }
    })
})
