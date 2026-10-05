import type * as SQLite from 'expo-sqlite'
import { buildPrincipalWhereClause, getScopedUserId } from '@/src/data/principal'
import { buildPhotoKey, nextPhotoKey } from '@/src/data/sync/photoSync'
import { type Equipment, type MuscleKey, muscleGroupOf, serializeSecondaryMuscles } from '@/src/domain/exerciseTaxonomy'
import { getDb } from './client'
import { createEntityUuid, nowIso, recordDeletionTombstone, type SyncStatus } from './sync'
import { executeWriteTransaction } from './writeQueue'

export type ExerciseType = 'weight' | 'cardio' | 'bodyweight' | 'bodyweight_timer'

export interface Exercise {
    id: number
    uuid?: string
    user_id?: string | null
    name: string
    type: ExerciseType
    // Legacy free text (pre ADR-0007); since then a mirror of the primary
    // Muscle's group for older app versions. Read Muscles through
    // resolveExerciseMuscles, never from this column.
    muscle_group?: string
    // The three taxonomy columns hold raw stored strings: a newer client may
    // have written keys this one doesn't know. Narrow them with asMuscleKey /
    // asEquipment, or read Muscles through resolveExerciseMuscles.
    primary_muscle?: string | null
    // JSON array of Muscle keys, as stored.
    secondary_muscles?: string | null
    equipment?: string | null
    photo_uri?: string | null
    photo_key?: string | null
    position: number
    created_at?: string
    updated_at?: string
    deleted_at?: string | null
    sync_status?: SyncStatus
    last_synced_at?: string | null
}

// An Exercise's Muscles, always written together: the primary, its secondary
// Muscles, and the muscle_group mirror derived from them. `legacyText` is
// kept (trimmed and lowercased) in muscle_group when there is no primary (e.g.
// a CSV cell that maps to no Muscle), so unrecognized input is never thrown away.
export type ExerciseMusclesInput = {
    primary: MuscleKey | null
    secondary: MuscleKey[]
    legacyText?: string
}

// The descriptive fields of a new Exercise.
export type ExerciseDetails = {
    muscles?: ExerciseMusclesInput
    equipment?: Equipment | null
    photoUri?: string | null
}

// The fields an edit may change; every field left undefined is untouched.
export type ExerciseUpdate = ExerciseDetails & {
    name?: string
    type?: ExerciseType
    position?: number
}

// muscle_group mirrors the primary Muscle's group so older clients keep
// showing something sensible (and so a later edit by one is detectable, see
// resolveExerciseMuscles); without a primary, the legacy text is kept.
const mirroredMuscleGroup = (muscles: ExerciseMusclesInput): string | null =>
    muscles.primary ? muscleGroupOf(muscles.primary) : muscles.legacyText?.trim().toLowerCase() || null

const NO_MUSCLES: ExerciseMusclesInput = { primary: null, secondary: [] }

// Exercises are soft-deleted: the row stays with deleted_at set, so the Sets
// that reference it keep their history (the sets → exercises foreign key
// cascades on a hard DELETE). The tombstone carries the deletion to remote.
// The photo goes with the Exercise, so the row stops pointing at it. The sync
// status is left alone: a synced row needs only the tombstone, and an unpushed
// one still pushes (as deleted) so its Sets have a remote parent. Runs inside
// the caller's transaction; returns whether a live row in scope was deleted.
export const softDeleteExercise = async (db: SQLite.SQLiteDatabase, id: number): Promise<boolean> => {
    const scope = buildPrincipalWhereClause('user_id')
    const entity = await db.getFirstAsync<{ uuid: string; user_id: string | null }>(
        `SELECT uuid, user_id FROM exercises WHERE id = ? AND deleted_at IS NULL AND ${scope.clause}`,
        id,
        ...scope.params
    )
    if (!entity?.uuid) return false
    const now = nowIso()
    await recordDeletionTombstone(db, 'exercise', entity.uuid, entity.user_id, now)
    await db.runAsync(
        `UPDATE exercises SET deleted_at = ?, updated_at = ?, photo_uri = NULL, photo_key = NULL WHERE id = ?`,
        now,
        now,
        id
    )
    return true
}

export const ExerciseRepository = {
    async getAll(): Promise<Exercise[]> {
        const db = await getDb()
        const scope = buildPrincipalWhereClause('user_id')
        return await db.getAllAsync<Exercise>(
            `SELECT * FROM exercises
             WHERE deleted_at IS NULL AND ${scope.clause}
             ORDER BY position ASC, name ASC`,
            ...scope.params
        )
    },

    async getById(id: number): Promise<Exercise | null> {
        const db = await getDb()
        const scope = buildPrincipalWhereClause('user_id')
        const result = await db.getFirstAsync<Exercise>(
            `SELECT * FROM exercises
             WHERE id = ? AND deleted_at IS NULL AND ${scope.clause}`,
            id,
            ...scope.params
        )
        return result ?? null
    },

    async create(name: string, type: ExerciseType, details: ExerciseDetails = {}): Promise<number> {
        return executeWriteTransaction(async (db) => {
            const scope = buildPrincipalWhereClause('user_id')
            const lastEx = await db.getFirstAsync<{ position: number }>(
                `SELECT position FROM exercises
                 WHERE deleted_at IS NULL AND ${scope.clause}
                 ORDER BY position DESC LIMIT 1`,
                ...scope.params
            )
            const nextPosition = lastEx ? lastEx.position + 1 : 0
            const now = nowIso()
            const uuid = createEntityUuid()
            const muscles = details.muscles ?? NO_MUSCLES
            const photoUri = details.photoUri ?? null

            const result = await db.runAsync(
                `INSERT INTO exercises
                 (uuid, user_id, name, type, muscle_group, primary_muscle, secondary_muscles, equipment,
                  photo_uri, photo_key, position, created_at, updated_at, sync_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                uuid,
                getScopedUserId(),
                name,
                type.toLowerCase(),
                mirroredMuscleGroup(muscles),
                muscles.primary,
                serializeSecondaryMuscles(muscles.secondary, muscles.primary),
                details.equipment ?? null,
                photoUri,
                buildPhotoKey(uuid, photoUri),
                nextPosition,
                now,
                now,
                'dirty'
            )
            return result.lastInsertRowId
        })
    },

    async update(id: number, data: ExerciseUpdate): Promise<void> {
        const fields: string[] = []
        const values: (string | number | null)[] = []

        if (data.name !== undefined) {
            fields.push('name = ?')
            values.push(data.name)
        }
        if (data.type !== undefined) {
            fields.push('type = ?')
            values.push(data.type.toLowerCase())
        }
        if (data.muscles !== undefined) {
            fields.push('primary_muscle = ?', 'secondary_muscles = ?', 'muscle_group = ?')
            values.push(
                data.muscles.primary,
                serializeSecondaryMuscles(data.muscles.secondary, data.muscles.primary),
                mirroredMuscleGroup(data.muscles)
            )
        }
        if (data.equipment !== undefined) {
            fields.push('equipment = ?')
            values.push(data.equipment)
        }
        if (data.photoUri !== undefined) {
            fields.push('photo_uri = ?')
            values.push(data.photoUri ?? null)
        }
        if (data.position !== undefined) {
            fields.push('position = ?')
            values.push(data.position)
        }

        if (fields.length === 0) return

        const scope = buildPrincipalWhereClause('user_id')
        await executeWriteTransaction(async (db) => {
            if (data.photoUri !== undefined) {
                // The synced photo_key follows the local photo: regenerated when
                // the photo changed, kept when only metadata changed (see
                // nextPhotoKey). Read inside the transaction so the key derives
                // from the exact row this update replaces.
                const current = await db.getFirstAsync<{
                    uuid: string
                    photo_uri: string | null
                    photo_key: string | null
                }>(
                    `SELECT uuid, photo_uri, photo_key FROM exercises
                     WHERE id = ? AND deleted_at IS NULL AND ${scope.clause}`,
                    id,
                    ...scope.params
                )
                if (current?.uuid) {
                    fields.push('photo_key = ?')
                    values.push(
                        nextPhotoKey(
                            current.photo_key ?? null,
                            current.photo_uri ?? null,
                            current.uuid,
                            data.photoUri ?? null
                        )
                    )
                }
            }

            fields.push('updated_at = ?')
            values.push(nowIso())
            fields.push('sync_status = ?')
            values.push('dirty')
            values.push(id)
            await db.runAsync(
                `UPDATE exercises SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL AND ${scope.clause}`,
                ...values,
                ...scope.params
            )
        })
    },

    async updatePositions(updates: { id: number; position: number }[]): Promise<void> {
        await executeWriteTransaction(async (db) => {
            const scope = buildPrincipalWhereClause('user_id')
            for (const update of updates) {
                await db.runAsync(
                    `UPDATE exercises
                     SET position = ?, updated_at = ?, sync_status = ?
                     WHERE id = ? AND deleted_at IS NULL AND ${scope.clause}`,
                    update.position,
                    nowIso(),
                    'dirty',
                    update.id,
                    ...scope.params
                )
            }
        })
    },

    async delete(id: number): Promise<void> {
        await executeWriteTransaction((db) => softDeleteExercise(db, id))
    },
}
