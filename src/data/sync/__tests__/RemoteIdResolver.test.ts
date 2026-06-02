import { describe, expect, it } from 'vitest'
import { createFakeSupabaseAdapter } from '@/src/test/fakeSupabase'
import { createRemoteIdResolver } from '../RemoteIdResolver'

describe('RemoteIdResolver', () => {
    it('issues at most one query per parent type per cycle, regardless of how many resolveMany calls are made', async () => {
        const adapter = createFakeSupabaseAdapter()
        // Seed the fake so the parents exist remotely.
        await adapter.upsert('workouts', [
            { uuid: 'wk-1', user_id: 'u', date: '2026-01-01' },
            { uuid: 'wk-2', user_id: 'u', date: '2026-01-02' },
            { uuid: 'wk-3', user_id: 'u', date: '2026-01-03' },
        ])
        await adapter.upsert('exercises', [{ uuid: 'ex-1', user_id: 'u', name: 'Bench' }])

        const resolver = createRemoteIdResolver(adapter)

        // First batch — should hit the remote once per table.
        const r1 = await resolver.resolveMany('workouts', ['wk-1', 'wk-2'])
        const r2 = await resolver.resolveMany('exercises', ['ex-1'])
        // Second batch within the same cycle — wk-1 is cached, wk-3 is new.
        const r3 = await resolver.resolveMany('workouts', ['wk-1', 'wk-3'])
        // Third batch — entirely cached, must not hit the network at all.
        const r4 = await resolver.resolveMany('workouts', ['wk-1', 'wk-2'])

        expect(r1.get('wk-1')).toBeGreaterThan(0)
        expect(r1.get('wk-2')).toBeGreaterThan(0)
        expect(r2.get('ex-1')).toBeGreaterThan(0)
        expect(r3.get('wk-3')).toBeGreaterThan(0)
        expect(r4.get('wk-1')).toBe(r1.get('wk-1'))

        const calls = adapter.callCounts().selectIdsByUuids
        // 2 calls to workouts (first batch + the one that needed wk-3); never
        // more than one per resolve-with-new-uuid event.
        expect(calls.workouts).toBe(2)
        expect(calls.exercises).toBe(1)
    })

    it('omits uuids the remote does not know about (caller decides what to do)', async () => {
        const adapter = createFakeSupabaseAdapter()
        const resolver = createRemoteIdResolver(adapter)
        const result = await resolver.resolveMany('workouts', ['wk-missing'])
        expect(result.has('wk-missing')).toBe(false)
    })

    it('a fresh resolver does not see ids from a previous cycle (per-cycle isolation)', async () => {
        const adapter = createFakeSupabaseAdapter()
        await adapter.upsert('workouts', [{ uuid: 'wk-1', user_id: 'u', date: '2026-01-01' }])

        const r1 = createRemoteIdResolver(adapter)
        await r1.resolveMany('workouts', ['wk-1'])

        const r2 = createRemoteIdResolver(adapter)
        await r2.resolveMany('workouts', ['wk-1'])

        // Two cycles → two queries against the remote.
        expect(adapter.callCounts().selectIdsByUuids.workouts).toBe(2)
    })
})
