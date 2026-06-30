import type * as SQLite from 'expo-sqlite'
import { buildPrincipalWhereClause } from '@/src/data/principal'
import { executeWriteTransaction } from './writeQueue'

export type SyncStatus = 'local' | 'dirty' | 'synced' | 'failed' | 'blocked'
export type SyncEntityType = 'exercise' | 'workout' | 'set'

export const nowIso = () => new Date().toISOString()

export const createEntityUuid = (): string => {
    const randomPart = Math.random().toString(36).slice(2, 10)
    const secondPart = Math.random().toString(36).slice(2, 10)
    return `${Date.now().toString(36)}-${randomPart}-${secondPart}`
}

export const recordDeletionTombstone = async (
    db: SQLite.SQLiteDatabase,
    entityType: SyncEntityType,
    entityUuid: string,
    userId?: string | null
) => {
    await db.runAsync(
        `INSERT INTO deletion_tombstones (entity_type, entity_uuid, user_id, deleted_at, sync_status)
     VALUES (?, ?, ?, ?, 'dirty')`,
        entityType,
        entityUuid,
        userId ?? null,
        nowIso()
    )
}

// Hard-delete a row by id within the current principal scope, first recording a
// deletion tombstone so the removal propagates on the next sync. Shared by the
// per-entity repositories whose delete logic differs only by table + type.
export const softDeleteById = async (table: string, entityType: SyncEntityType, id: number): Promise<void> => {
    await executeWriteTransaction(async (db) => {
        const scope = buildPrincipalWhereClause('user_id')
        const entity = await db.getFirstAsync<{ uuid: string; user_id?: string | null }>(
            `SELECT uuid, user_id FROM ${table} WHERE id = ? AND ${scope.clause}`,
            id,
            ...scope.params
        )
        if (entity?.uuid) {
            await recordDeletionTombstone(db, entityType, entity.uuid, entity.user_id)
        }
        await db.runAsync(`DELETE FROM ${table} WHERE id = ? AND ${scope.clause}`, id, ...scope.params)
    })
}
