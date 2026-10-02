import { buildPrincipalWhereClause, getScopedUserId } from '@/src/data/principal'
import { getDb } from './client'
import { createEntityUuid, nowIso, type SyncStatus, softDeleteById } from './sync'
import { parseExerciseUuids, serializeExerciseUuids } from './templateMembership'
import { executeWriteTransaction } from './writeQueue'

// A named, reusable list of Exercises a Planned Workout is started from
// (ADR-0006). Membership is held as Exercise uuids; readers resolve them
// against the live Exercise list, so a deleted Exercise simply drops out.
export interface WorkoutTemplate {
    id: number
    uuid: string
    user_id?: string | null
    name: string
    exercise_uuids: string[]
    position: number
    created_at?: string
    updated_at?: string
    deleted_at?: string | null
    sync_status?: SyncStatus
    last_synced_at?: string | null
}

export interface WorkoutTemplateInput {
    name: string
    exerciseUuids: string[]
}

type WorkoutTemplateDbRow = Omit<WorkoutTemplate, 'exercise_uuids'> & { exercise_uuids: string | null }

const fromRow = (row: WorkoutTemplateDbRow): WorkoutTemplate => ({
    ...row,
    exercise_uuids: parseExerciseUuids(row.exercise_uuids),
})

export const WorkoutTemplateRepository = {
    async getAll(): Promise<WorkoutTemplate[]> {
        const db = await getDb()
        const scope = buildPrincipalWhereClause('user_id')
        const rows = await db.getAllAsync<WorkoutTemplateDbRow>(
            `SELECT * FROM workout_templates
             WHERE deleted_at IS NULL AND ${scope.clause}
             ORDER BY position ASC, name COLLATE NOCASE ASC`,
            ...scope.params
        )
        return rows.map(fromRow)
    },

    async getById(id: number): Promise<WorkoutTemplate | null> {
        const db = await getDb()
        const scope = buildPrincipalWhereClause('user_id')
        const row = await db.getFirstAsync<WorkoutTemplateDbRow>(
            `SELECT * FROM workout_templates
             WHERE id = ? AND deleted_at IS NULL AND ${scope.clause}`,
            id,
            ...scope.params
        )
        return row ? fromRow(row) : null
    },

    async getByUuid(uuid: string): Promise<WorkoutTemplate | null> {
        const db = await getDb()
        const scope = buildPrincipalWhereClause('user_id')
        const row = await db.getFirstAsync<WorkoutTemplateDbRow>(
            `SELECT * FROM workout_templates
             WHERE uuid = ? AND deleted_at IS NULL AND ${scope.clause}`,
            uuid,
            ...scope.params
        )
        return row ? fromRow(row) : null
    },

    async create(input: WorkoutTemplateInput): Promise<number> {
        return executeWriteTransaction(async (db) => {
            const scope = buildPrincipalWhereClause('user_id')
            const last = await db.getFirstAsync<{ position: number }>(
                `SELECT position FROM workout_templates
                 WHERE deleted_at IS NULL AND ${scope.clause}
                 ORDER BY position DESC LIMIT 1`,
                ...scope.params
            )
            const now = nowIso()
            const result = await db.runAsync(
                `INSERT INTO workout_templates
                 (uuid, user_id, name, exercise_uuids, position, created_at, updated_at, sync_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                createEntityUuid(),
                getScopedUserId(),
                input.name.trim(),
                serializeExerciseUuids(input.exerciseUuids),
                last ? last.position + 1 : 0,
                now,
                now,
                'dirty'
            )
            return result.lastInsertRowId
        })
    },

    // Resolves to the number of rows written: 0 means the Template is gone (for
    // example deleted on another device and removed by sync meanwhile).
    async update(id: number, input: Partial<WorkoutTemplateInput>): Promise<number> {
        const fields: string[] = []
        const values: (string | number | null)[] = []
        if (input.name !== undefined) {
            fields.push('name = ?')
            values.push(input.name.trim())
        }
        if (input.exerciseUuids !== undefined) {
            fields.push('exercise_uuids = ?')
            values.push(serializeExerciseUuids(input.exerciseUuids))
        }
        if (fields.length === 0) return 0

        const scope = buildPrincipalWhereClause('user_id')
        const result = await executeWriteTransaction((db) =>
            db.runAsync(
                `UPDATE workout_templates
                 SET ${fields.join(', ')}, updated_at = ?, sync_status = 'dirty'
                 WHERE id = ? AND deleted_at IS NULL AND ${scope.clause}`,
                ...values,
                nowIso(),
                id,
                ...scope.params
            )
        )
        return result.changes
    },

    // Workouts started from this Template keep their template_uuid; it just no
    // longer resolves, so they read as Unplanned and history stays untouched.
    async delete(id: number): Promise<void> {
        await softDeleteById('workout_templates', 'workout_template', id)
    },
}
