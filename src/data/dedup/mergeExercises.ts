import { invalidateExercisesCache } from '@/src/data/exercisesCache'
import { buildPrincipalWhereClause } from '@/src/data/principal'
import { buildPhotoKey } from '@/src/data/sync/photoSync'
import { getDb } from '@/src/db/client'
import { ExerciseRepository, softDeleteExercise } from '@/src/db/exercises'
import { nowIso } from '@/src/db/sync'
import { repointExerciseUuids } from '@/src/db/templateMembership'
import { executeWriteTransaction } from '@/src/db/writeQueue'
import { hasExplicitMuscles, resolveExerciseMuscles } from '@/src/domain/exerciseTaxonomy'
import { type DuplicateGroup, findDuplicateExerciseGroups } from './exerciseDedup'

export type MergeExercisesInput = {
    survivorId: number
    duplicateIds: number[]
}

export type MergeExercisesResult = {
    setsRepointed: number
    exercisesDeleted: number
    templatesRepointed: number
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
// soft-delete the duplicate Exercises with a tombstone (softDeleteExercise).
// The duplicate's photo, if moved onto the survivor, is no longer referenced
// by the deleted row. All principal-scoped (ADR-0005).
export const mergeDuplicateExercises = async (input: MergeExercisesInput): Promise<MergeExercisesResult> => {
    const duplicateIds = input.duplicateIds.filter((id) => id !== input.survivorId)
    if (duplicateIds.length === 0) return { setsRepointed: 0, exercisesDeleted: 0, templatesRepointed: 0 }

    const result = await executeWriteTransaction(async (db) => {
        const now = nowIso()
        const placeholders = duplicateIds.map(() => '?').join(', ')
        const scope = buildPrincipalWhereClause('user_id')

        const survivor = await db.getFirstAsync<{
            uuid: string
            photo_uri: string | null
            muscle_group: string | null
            primary_muscle: string | null
            secondary_muscles: string | null
            equipment: string | null
        }>(
            `SELECT uuid, photo_uri, muscle_group, primary_muscle, secondary_muscles, equipment
             FROM exercises WHERE id = ? AND deleted_at IS NULL AND ${scope.clause}`,
            input.survivorId,
            ...scope.params
        )
        // A survivor deleted meanwhile (e.g. by a pull while the review was
        // open) must not absorb the group: every member would end up deleted.
        if (!survivor) return { setsRepointed: 0, exercisesDeleted: 0, templatesRepointed: 0 }

        const repoint = await db.runAsync(
            `UPDATE sets SET exercise_id = ?, updated_at = ?, sync_status = 'dirty'
             WHERE exercise_id IN (${placeholders}) AND ${scope.clause}`,
            input.survivorId,
            now,
            ...duplicateIds,
            ...scope.params
        )

        // Back-fill fields the survivor is missing from the losers, so keeping
        // one row never silently drops a photo or muscle group the other had.
        let fillPhotoUri = survivor?.photo_uri ?? null
        let fillMuscleGroup = survivor?.muscle_group ?? null
        // Explicit taxonomy keys travel as one unit (primary, secondary and the
        // mirrored group), so a merge never mixes two Exercises' Muscles.
        let fillTaxonomy: { primary: string; secondary: string | null; group: string | null } | null = null
        let fillEquipment = survivor?.equipment ?? null

        let exercisesDeleted = 0
        const duplicateUuids = new Set<string>()
        for (const duplicateId of duplicateIds) {
            const row = await db.getFirstAsync<{
                uuid: string
                photo_uri: string | null
                muscle_group: string | null
                primary_muscle: string | null
                secondary_muscles: string | null
                equipment: string | null
            }>(
                `SELECT uuid, photo_uri, muscle_group, primary_muscle, secondary_muscles, equipment
                 FROM exercises WHERE id = ? AND deleted_at IS NULL AND ${scope.clause}`,
                duplicateId,
                ...scope.params
            )
            if (!row?.uuid) continue
            duplicateUuids.add(row.uuid)
            if (!fillPhotoUri && row.photo_uri) fillPhotoUri = row.photo_uri
            if (!fillMuscleGroup && row.muscle_group) fillMuscleGroup = row.muscle_group
            // Only a survivor that resolves to *no* Muscle takes the duplicate's.
            // Anything it does resolve to — explicit keys, mappable legacy text,
            // or an older client's latest edit — is the survivor's own data.
            if (
                survivor &&
                !resolveExerciseMuscles(survivor).primary &&
                !fillTaxonomy &&
                hasExplicitMuscles(row) &&
                row.primary_muscle
            ) {
                fillTaxonomy = {
                    primary: row.primary_muscle,
                    secondary: row.secondary_muscles,
                    group: row.muscle_group,
                }
            }
            if (!fillEquipment && row.equipment) fillEquipment = row.equipment
            if (await softDeleteExercise(db, duplicateId)) exercisesDeleted += 1
        }

        const gainsPhoto = !survivor?.photo_uri && !!fillPhotoUri
        const gainsMuscle = !survivor?.muscle_group && !!fillMuscleGroup
        const gainsTaxonomy = !!fillTaxonomy
        const gainsEquipment = !survivor?.equipment && !!fillEquipment
        if (survivor && (gainsPhoto || gainsMuscle || gainsTaxonomy || gainsEquipment)) {
            await db.runAsync(
                `UPDATE exercises
                 SET photo_uri = ?, photo_key = ?, muscle_group = ?, primary_muscle = ?, secondary_muscles = ?,
                     equipment = ?, updated_at = ?, sync_status = 'dirty'
                 WHERE id = ? AND ${scope.clause}`,
                fillPhotoUri,
                buildPhotoKey(survivor.uuid, fillPhotoUri),
                fillTaxonomy?.group ?? fillMuscleGroup,
                fillTaxonomy?.primary ?? survivor.primary_muscle,
                fillTaxonomy ? fillTaxonomy.secondary : survivor.secondary_muscles,
                fillEquipment,
                now,
                input.survivorId,
                ...scope.params
            )
        }

        // Workout Templates reference Exercises by uuid, so membership follows
        // the merge onto the Survivor the same way Sets do (ADR-0006).
        let templatesRepointed = 0
        if (survivor?.uuid && duplicateUuids.size > 0) {
            const templates = await db.getAllAsync<{ id: number; exercise_uuids: string | null }>(
                `SELECT id, exercise_uuids FROM workout_templates WHERE ${scope.clause}`,
                ...scope.params
            )
            for (const template of templates) {
                const next = repointExerciseUuids(template.exercise_uuids, duplicateUuids, survivor.uuid)
                if (next === null) continue
                await db.runAsync(
                    `UPDATE workout_templates SET exercise_uuids = ?, updated_at = ?, sync_status = 'dirty'
                     WHERE id = ? AND ${scope.clause}`,
                    next,
                    now,
                    template.id,
                    ...scope.params
                )
                templatesRepointed += 1
            }
        }

        return { setsRepointed: repoint.changes, exercisesDeleted, templatesRepointed }
    })

    // The raw merge bypasses the cached repository, so the exercises list cache
    // must be invalidated explicitly or the deleted duplicate lingers in the UI
    // until the next principal change or sync pull.
    if (result.exercisesDeleted > 0 || result.setsRepointed > 0) {
        invalidateExercisesCache()
    }
    return result
}
