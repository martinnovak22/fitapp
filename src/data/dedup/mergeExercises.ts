import { buildPrincipalWhereClause } from '@/src/data/principal'
import { getDb } from '@/src/db/client'
import { ExerciseRepository } from '@/src/db/exercises'
import { nowIso, recordDeletionTombstone } from '@/src/db/sync'
import { executeWriteTransaction } from '@/src/db/writeQueue'
import { type DuplicateGroup, findDuplicateExerciseGroups } from './exerciseDedup'

export type MergeExercisesInput = {
    survivorId: number
    duplicateIds: number[]
}

export type MergeExercisesResult = {
    setsRepointed: number
    exercisesDeleted: number
}

// Live referencing-Set counts per exercise id, within the active principal
// scope. Feeds the survivor heuristic in findDuplicateExerciseGroups.
export const getExerciseSetCounts = async (): Promise<Map<number, number>> => {
    const db = await getDb()
    const scope = buildPrincipalWhereClause('user_id')
    const rows = await db.getAllAsync<{ exercise_id: number; count: number }>(
        `SELECT exercise_id, COUNT(*) AS count FROM sets
         WHERE deleted_at IS NULL AND ${scope.clause}
         GROUP BY exercise_id`,
        ...scope.params
    )
    return new Map(rows.map((row) => [row.exercise_id, row.count]))
}

// The read side of the Exercise De-duplication maintenance action: load the
// active principal's live Exercises and their Set counts, then group them.
export const findDuplicateExercises = async (): Promise<DuplicateGroup[]> => {
    const [exercises, setCounts] = await Promise.all([ExerciseRepository.getAll(), getExerciseSetCounts()])
    return findDuplicateExerciseGroups(exercises, setCounts)
}

// Merge a confirmed Duplicate Group onto its survivor in one transaction:
// re-point the duplicates' Sets onto the survivor (marked dirty), then
// tombstone-and-delete the duplicate Exercises. Re-pointing precedes deletion
// so the sets→exercises ON DELETE CASCADE never strands a Set. All
// principal-scoped (ADR-0005).
export const mergeDuplicateExercises = async (input: MergeExercisesInput): Promise<MergeExercisesResult> => {
    const duplicateIds = input.duplicateIds.filter((id) => id !== input.survivorId)
    if (duplicateIds.length === 0) return { setsRepointed: 0, exercisesDeleted: 0 }

    return executeWriteTransaction(async (db) => {
        const now = nowIso()
        const placeholders = duplicateIds.map(() => '?').join(', ')
        const scope = buildPrincipalWhereClause('user_id')

        const repoint = await db.runAsync(
            `UPDATE sets SET exercise_id = ?, updated_at = ?, sync_status = 'dirty'
             WHERE exercise_id IN (${placeholders}) AND ${scope.clause}`,
            input.survivorId,
            now,
            ...duplicateIds,
            ...scope.params
        )

        let exercisesDeleted = 0
        for (const duplicateId of duplicateIds) {
            const row = await db.getFirstAsync<{ uuid: string; user_id: string | null }>(
                `SELECT uuid, user_id FROM exercises WHERE id = ? AND ${scope.clause}`,
                duplicateId,
                ...scope.params
            )
            if (!row?.uuid) continue
            await recordDeletionTombstone(db, 'exercise', row.uuid, row.user_id)
            const deleted = await db.runAsync(
                `DELETE FROM exercises WHERE id = ? AND ${scope.clause}`,
                duplicateId,
                ...scope.params
            )
            exercisesDeleted += deleted.changes
        }

        return { setsRepointed: repoint.changes, exercisesDeleted }
    })
}
