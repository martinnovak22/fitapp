// RemoteIdResolver: batches parent-uuid → remote-id lookups for the sets push
// path. A single query per parent type per cycle, cached for the cycle. A
// fresh resolver is created at cycle start so IDs never leak between cycles.

import type { RemoteAdapter, RemoteTable } from './RemoteAdapter'

export type ParentTable = Extract<RemoteTable, 'exercises' | 'workouts'>

export type RemoteIdResolver = {
    resolveMany(table: ParentTable, uuids: string[]): Promise<Map<string, number>>
    /**
     * Record IDs we just learned out-of-band (e.g. from a successful upsert
     * in the same cycle). Lets the cycle avoid round-tripping to look up an
     * ID it already received as part of the parent's write response.
     */
    record(table: ParentTable, entries: { uuid: string; id: number }[]): void
}

export const createRemoteIdResolver = (adapter: RemoteAdapter): RemoteIdResolver => {
    const caches: Record<ParentTable, Map<string, number>> = {
        exercises: new Map(),
        workouts: new Map(),
    }
    // Track uuids we already asked about but the remote didn't know — avoids
    // repeating the same negative lookup later in the cycle.
    const negativeCache: Record<ParentTable, Set<string>> = {
        exercises: new Set(),
        workouts: new Set(),
    }

    return {
        async resolveMany(table, uuids) {
            const cache = caches[table]
            const negs = negativeCache[table]
            const missing = [...new Set(uuids.filter((u) => !cache.has(u) && !negs.has(u)))]
            if (missing.length > 0) {
                const found = await adapter.selectIdsByUuids(table, missing)
                const foundUuids = new Set(found.map((f) => f.uuid))
                for (const f of found) cache.set(f.uuid, f.id)
                for (const u of missing) if (!foundUuids.has(u)) negs.add(u)
            }
            const out = new Map<string, number>()
            for (const uuid of uuids) {
                const id = cache.get(uuid)
                if (id !== undefined) out.set(uuid, id)
            }
            return out
        },

        record(table, entries) {
            const cache = caches[table]
            const negs = negativeCache[table]
            for (const { uuid, id } of entries) {
                cache.set(uuid, id)
                negs.delete(uuid)
            }
        },
    }
}
