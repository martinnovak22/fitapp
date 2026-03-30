import { getDb } from './client'
import { nowIso } from './sync'
import { executeWriteTransaction } from './writeQueue'

export const clearLocalUserData = async (): Promise<void> => {
    await executeWriteTransaction(async (db) => {
        await db.runAsync('DELETE FROM sets')
        await db.runAsync('DELETE FROM workouts')
        await db.runAsync('DELETE FROM exercises')
        await db.runAsync('DELETE FROM deletion_tombstones')
        await db.runAsync('DELETE FROM sync_queue')

        await db.runAsync(
            `UPDATE sync_state
             SET is_syncing = 0,
                 outbox_size = 0,
                 last_success_at = NULL,
                 last_attempt_at = NULL,
                 last_error = NULL
             WHERE id = 1`
        )

        await db.runAsync(
            "DELETE FROM sqlite_sequence WHERE name IN ('sets', 'workouts', 'exercises', 'deletion_tombstones', 'sync_queue')"
        )
    })
}

export const hasLocalUserData = async (): Promise<boolean> => {
    const db = await getDb()
    const [exerciseCount, workoutCount, setCount] = await Promise.all([
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercises'),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM workouts'),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sets'),
    ])

    return (exerciseCount?.count ?? 0) > 0 || (workoutCount?.count ?? 0) > 0 || (setCount?.count ?? 0) > 0
}

export const migrateGuestDataToUser = async (userId: string): Promise<void> => {
    await executeWriteTransaction(async (db) => {
        const now = nowIso()
        await db.runAsync(
            `UPDATE exercises
             SET user_id = ?, updated_at = ?, sync_status = 'dirty'
             WHERE user_id IS NULL`,
            userId,
            now
        )
        await db.runAsync(
            `UPDATE workouts
             SET user_id = ?, updated_at = ?, sync_status = 'dirty'
             WHERE user_id IS NULL`,
            userId,
            now
        )
        await db.runAsync(
            `UPDATE sets
             SET user_id = ?, updated_at = ?, sync_status = 'dirty'
             WHERE user_id IS NULL`,
            userId,
            now
        )
        await db.runAsync(
            `UPDATE deletion_tombstones
             SET user_id = ?, sync_status = CASE WHEN sync_status = 'synced' THEN 'dirty' ELSE sync_status END
             WHERE user_id IS NULL`,
            userId
        )
    })
}
