// RemoteWriter: thin adapter over the remote upsert path that proves
// persistence before reporting success. A silently-empty insert from the
// backend is no longer indistinguishable from a real ack.

import type { SyncFailureReason } from './Outbox'
import type { RemoteAdapter, RemoteRow, RemoteTable } from './RemoteAdapter'

export type RemoteWriteResult =
    | { uuid: string; kind: 'persisted'; id: number }
    | { uuid: string; kind: 'failed'; reason: SyncFailureReason }

// Adapter contract: thrown errors represent transport failures (connection
// reset, DNS, timeout, 5xx). Remote-rejection (4xx, empty body) is surfaced
// through the structured return value, not via throw.
const failureFromError = (error: unknown): SyncFailureReason => ({
    kind: 'network-error',
    message: error instanceof Error ? error.message : String(error),
})

export type RemoteWriter = {
    upsert(table: RemoteTable, rows: RemoteRow[]): Promise<RemoteWriteResult[]>
    patch(table: RemoteTable, uuid: string, userId: string, patch: Partial<RemoteRow>): Promise<RemoteWriteResult>
}

export const createRemoteWriter = (adapter: RemoteAdapter): RemoteWriter => ({
    async upsert(table, rows) {
        if (rows.length === 0) return []
        let acks: { id: number; uuid: string }[]
        try {
            acks = await adapter.upsert(table, rows)
        } catch (error) {
            const reason = failureFromError(error)
            return rows.map((row) => ({ uuid: row.uuid, kind: 'failed', reason }))
        }
        const idByUuid = new Map(acks.map((a) => [a.uuid, a.id]))
        return rows.map((row): RemoteWriteResult => {
            const id = idByUuid.get(row.uuid)
            if (id === undefined) {
                return {
                    uuid: row.uuid,
                    kind: 'failed',
                    reason: {
                        kind: 'remote-rejection',
                        message: `upsert to ${table} returned no row for uuid ${row.uuid} — server did not confirm persistence`,
                    },
                }
            }
            return { uuid: row.uuid, kind: 'persisted', id }
        })
    },

    async patch(table, uuid, userId, patch) {
        try {
            await adapter.patchByUuid(table, uuid, userId, patch)
            return { uuid, kind: 'persisted', id: -1 }
        } catch (error) {
            return { uuid, kind: 'failed', reason: failureFromError(error) }
        }
    },
})
