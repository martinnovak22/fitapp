import { getDb } from './client';

export type ExerciseType = 'weight' | 'cardio' | 'bodyweight' | 'bodyweight_timer';

export interface Exercise {
    id: number;
    name: string;
    type: ExerciseType;
    muscle_group?: string;
    photo_uri?: string | null;
    position: number;
}

export const ExerciseRepository = {
    async getAll(): Promise<Exercise[]> {
        const db = await getDb();
        return await db.getAllAsync<Exercise>(
            'SELECT * FROM exercises ORDER BY position ASC, name ASC'
        );
    },

    async getById(id: number): Promise<Exercise | null> {
        const db = await getDb();
        const result = await db.getFirstAsync<Exercise>(
            'SELECT * FROM exercises WHERE id = ?',
            id
        );
        return result ?? null;
    },

    async create(name: string, type: ExerciseType, muscle_group?: string, photo_uri?: string): Promise<number> {
        const db = await getDb();
        const lastEx = await db.getFirstAsync<{ position: number }>(
            'SELECT position FROM exercises ORDER BY position DESC LIMIT 1'
        );
        const nextPosition = lastEx ? lastEx.position + 1 : 0;

        const result = await db.runAsync(
            'INSERT INTO exercises (name, type, muscle_group, photo_uri, position) VALUES (?, ?, ?, ?, ?)',
            name,
            type.toLowerCase(),
            muscle_group?.toLowerCase() ?? null,
            photo_uri ?? null,
            nextPosition
        );
        return result.lastInsertRowId;
    },

    async update(id: number, data: Partial<Exercise>): Promise<void> {
        const db = await getDb();
        const fields: string[] = [];
        const values: Array<string | number | null> = [];

        if (data.name !== undefined) {
            fields.push('name = ?');
            values.push(data.name);
        }
        if (data.type !== undefined) {
            fields.push('type = ?');
            values.push(data.type.toLowerCase());
        }
        if (data.muscle_group !== undefined) {
            fields.push('muscle_group = ?');
            values.push(data.muscle_group?.toLowerCase() ?? null);
        }
        if (data.photo_uri !== undefined) {
            fields.push('photo_uri = ?');
            values.push(data.photo_uri ?? null);
        }
        if (data.position !== undefined) {
            fields.push('position = ?');
            values.push(data.position);
        }

        if (fields.length === 0) return;

        values.push(id);
        await db.runAsync(
            `UPDATE exercises SET ${fields.join(', ')} WHERE id = ?`,
            ...values
        );
    },

    async updatePositions(updates: { id: number; position: number }[]): Promise<void> {
        const db = await getDb();
        await db.withTransactionAsync(async () => {
            for (const update of updates) {
                await db.runAsync(
                    'UPDATE exercises SET position = ? WHERE id = ?',
                    update.position,
                    update.id
                );
            }
        });
    },

    async delete(id: number): Promise<void> {
        const db = await getDb();
        await db.runAsync('DELETE FROM exercises WHERE id = ?', id);
    }
};
