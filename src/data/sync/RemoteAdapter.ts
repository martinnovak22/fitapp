// Boundary between sync internals and the Supabase HTTP surface. RemoteWriter
// and RemoteIdResolver depend on this interface; the production wiring uses a
// PostgREST-backed adapter, tests use the FakeSupabaseAdapter.

export type RemoteTable = 'exercises' | 'workouts' | 'sets'

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
    patchByUuid(
        table: RemoteTable,
        uuid: string,
        userId: string,
        patch: Partial<RemoteRow>
    ): Promise<void>
}
