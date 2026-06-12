import { buildPrincipalWhereClause, getScopedUserId } from '@/src/data/principal'
import { getDb } from './client'
import { createEntityUuid, nowIso, type SyncStatus, softDeleteById } from './sync'
import { executeWrite, executeWriteTransaction } from './writeQueue'

export type ExerciseType = 'weight' | 'cardio' | 'bodyweight' | 'bodyweight_timer'

export interface Exercise {
    id: number
    uuid?: string
    user_id?: string | null
    name: string
    type: ExerciseType
    muscle_group?: string
    photo_uri?: string | null
    position: number
    created_at?: string
    updated_at?: string
    deleted_at?: string | null
    sync_status?: SyncStatus
    last_synced_at?: string | null
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

    async create(name: string, type: ExerciseType, muscle_group?: string, photo_uri?: string): Promise<number> {
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

            const result = await db.runAsync(
                `INSERT INTO exercises
                 (uuid, user_id, name, type, muscle_group, photo_uri, position, created_at, updated_at, sync_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                createEntityUuid(),
                getScopedUserId(),
                name,
                type.toLowerCase(),
                muscle_group?.toLowerCase() ?? null,
                photo_uri ?? null,
                nextPosition,
                now,
                now,
                'dirty'
            )
            return result.lastInsertRowId
        })
    },

    async update(id: number, data: Partial<Exercise>): Promise<void> {
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
        if (data.muscle_group !== undefined) {
            fields.push('muscle_group = ?')
            values.push(data.muscle_group?.toLowerCase() ?? null)
        }
        if (data.photo_uri !== undefined) {
            fields.push('photo_uri = ?')
            values.push(data.photo_uri ?? null)
        }
        if (data.position !== undefined) {
            fields.push('position = ?')
            values.push(data.position)
        }

        if (fields.length === 0) return

        fields.push('updated_at = ?')
        values.push(nowIso())
        fields.push('sync_status = ?')
        values.push('dirty')

        const scope = buildPrincipalWhereClause('user_id')
        values.push(id)
        await executeWrite((innerDb) =>
            innerDb.runAsync(
                `UPDATE exercises SET ${fields.join(', ')} WHERE id = ? AND ${scope.clause}`,
                ...values,
                ...scope.params
            )
        )
    },

    async updatePositions(updates: { id: number; position: number }[]): Promise<void> {
        await executeWriteTransaction(async (db) => {
            const scope = buildPrincipalWhereClause('user_id')
            for (const update of updates) {
                await db.runAsync(
                    `UPDATE exercises
                     SET position = ?, updated_at = ?, sync_status = ?
                     WHERE id = ? AND ${scope.clause}`,
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
        await softDeleteById('exercises', 'exercise', id)
    },
}
