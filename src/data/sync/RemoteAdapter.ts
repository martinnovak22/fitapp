// Boundary between sync internals and the Supabase HTTP surface. RemoteWriter
// and RemoteIdResolver depend on this interface; the production wiring uses a
// PostgREST-backed adapter, tests use the FakeSupabaseAdapter.

export type RemoteTable = 'exercises' | 'workouts' | 'sets'

// Carries the HTTP status of a failed PostgREST request so failures can be
// classified as permanent (the server refused the data) vs transient.
export class RemoteRequestError extends Error {
    constructor(
        message: string,
        readonly status: number
    ) {
        super(message)
        this.name = 'RemoteRequestError'
    }
}

// A 4xx (except auth/timeout/rate-limit) means the server rejected the data
// itself — retrying the same payload cannot succeed, so we give up immediately.
// 5xx, network errors, 401, 408 and 429 are transient and worth retrying.
export const isPermanentRejectionStatus = (status: number): boolean =>
    status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429

export type RemoteRow = Record<string, unknown> & {
    uuid: string
    user_id: string | null
    deleted_at?: string | null
    updated_at?: string | null
}

export type UpsertAck = { id: number; uuid: string }

export type RemoteAdapter = {
    upsert(table: RemoteTable, rows: RemoteRow[]): Promise<UpsertAck[]>
    selectIdsByUuids(table: RemoteTable, uuids: string[]): Promise<UpsertAck[]>
    patchByUuid(table: RemoteTable, uuid: string, userId: string, patch: Partial<RemoteRow>): Promise<void>
}
