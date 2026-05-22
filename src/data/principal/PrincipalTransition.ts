// Single entry point for every change of identity (guest↔account, account
// switch, sign-out). The whole transition runs in one SQLite transaction, so a
// failure mid-way leaves the local DB exactly as it was before.

import type * as SQLite from 'expo-sqlite'
import { nowIso } from '@/src/db/sync'
import { executeWriteTransaction } from '@/src/db/writeQueue'

export type PrincipalIdentity =
    | { kind: 'guest' }
    | { kind: 'account'; userId: string }
    | { kind: 'signed-out' }

export type MigrationPolicy = 'clear' | 'preserve'

export type TransitionOutcome =
    | {
          kind: 'ok'
          from: PrincipalIdentity
          to: PrincipalIdentity
          policy: MigrationPolicy
          rowsMigrated: number
          rowsCleared: number
      }
    | { kind: 'noop'; from: PrincipalIdentity; to: PrincipalIdentity }
    | {
          kind: 'error'
          from: PrincipalIdentity
          to: PrincipalIdentity
          policy: MigrationPolicy
          message: string
      }

type SqliteWrite = Pick<SQLite.SQLiteDatabase, 'runAsync'>

type DataTable = 'sets' | 'workouts' | 'exercises' | 'deletion_tombstones' | 'sync_queue'
const DATA_TABLES: DataTable[] = ['sets', 'workouts', 'exercises', 'deletion_tombstones', 'sync_queue']

const sameIdentity = (a: PrincipalIdentity, b: PrincipalIdentity): boolean => {
    if (a.kind !== b.kind) return false
    if (a.kind === 'account' && b.kind === 'account') return a.userId === b.userId
    return true
}

const clearLocal = async (db: SqliteWrite): Promise<number> => {
    let total = 0
    for (const table of DATA_TABLES) {
        const result = await db.runAsync(`DELETE FROM ${table}`)
        total += result.changes
    }
    await db.runAsync(
        `UPDATE sync_state
         SET is_syncing = 0, outbox_size = 0,
             last_success_at = NULL, last_attempt_at = NULL, last_error = NULL
         WHERE id = 1`
    )
    await db.runAsync(
        `DELETE FROM sqlite_sequence WHERE name IN ('sets','workouts','exercises','deletion_tombstones','sync_queue')`
    )
    return total
}

const migrateGuestToAccount = async (db: SqliteWrite, userId: string): Promise<number> => {
    const now = nowIso()
    let migrated = 0
    for (const table of ['exercises', 'workouts', 'sets'] as const) {
        const result = await db.runAsync(
            `UPDATE ${table}
             SET user_id = ?, updated_at = ?, sync_status = 'dirty'
             WHERE user_id IS NULL`,
            userId,
            now
        )
        migrated += result.changes
    }
    const tombstones = await db.runAsync(
        `UPDATE deletion_tombstones
         SET user_id = ?,
             sync_status = CASE WHEN sync_status = 'synced' THEN 'dirty' ELSE sync_status END
         WHERE user_id IS NULL`,
        userId
    )
    migrated += tombstones.changes
    return migrated
}

export const runPrincipalTransition = async (input: {
    from: PrincipalIdentity
    to: PrincipalIdentity
    policy: MigrationPolicy
}): Promise<TransitionOutcome> => {
    const { from, to, policy } = input
    if (sameIdentity(from, to)) {
        return { kind: 'noop', from, to }
    }

    try {
        return await executeWriteTransaction(async (db) => {
            if (policy === 'clear') {
                const rowsCleared = await clearLocal(db)
                return { kind: 'ok', from, to, policy, rowsMigrated: 0, rowsCleared }
            }
            // preserve
            if (from.kind === 'guest' && to.kind === 'account') {
                const rowsMigrated = await migrateGuestToAccount(db, to.userId)
                return { kind: 'ok', from, to, policy, rowsMigrated, rowsCleared: 0 }
            }
            // Preserve is only meaningful for guest→account. Any other shape
            // is a programming error — falling back to clear would silently
            // drop data, so surface it instead.
            throw new Error(
                `Unsupported preserve transition: ${from.kind} → ${to.kind}. Preserve is only valid for guest → account.`
            )
        })
    } catch (error) {
        return {
            kind: 'error',
            from,
            to,
            policy,
            message: error instanceof Error ? error.message : String(error),
        }
    }
}
