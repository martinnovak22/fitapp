import * as SQLite from 'expo-sqlite'

export type SyncStatus = 'local' | 'dirty' | 'synced' | 'failed'
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
