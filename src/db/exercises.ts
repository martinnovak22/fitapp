import { getDb } from './client';

export type ExerciseType = 'weight' | 'cardio' | 'bodyweight' | 'bodyweight_timer';

export interface Exercise {
    id: number;
    name: string;
    type: ExerciseType;
    muscle_group?: string;
    photo_uri?: string;
}

export const ExerciseRepository = {
    async getAll(): Promise<Exercise[]> {
        const db = await getDb();
        return await db.getAllAsync('SELECT * FROM exercises ORDER BY name ASC');
    },

    async create(name: string, type: ExerciseType, muscleGroup?: string): Promise<number> {
        const db = await getDb();
        const result = await db.runAsync(
            'INSERT INTO exercises (name, type, muscle_group) VALUES (?, ?, ?)',
            name,
            type,
            muscleGroup ?? null
        );
        return result.lastInsertRowId;
    },

    async update(id: number, data: Partial<Exercise>) {
        const db = await getDb();
        const fields = [];
        const values = [];

        if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
        if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
        if (data.muscle_group !== undefined) { fields.push('muscle_group = ?'); values.push(data.muscle_group); }

        if (fields.length === 0) return;

        values.push(id);
        await db.runAsync(`UPDATE exercises SET ${fields.join(', ')} WHERE id = ?`, ...values);
    },

    async delete(id: number) {
        const db = await getDb();
        await db.runAsync('DELETE FROM exercises WHERE id = ?', id);
    },

    async seedDefaults() {
        const db = await getDb();
        const existing = await db.getAllAsync('SELECT id FROM exercises LIMIT 1');
        if (existing.length === 0) {
            await db.runAsync("INSERT INTO exercises (name, type, muscle_group) VALUES ('Bench Press', 'Weight', 'Chest')");
            await db.runAsync("INSERT INTO exercises (name, type, muscle_group) VALUES ('Pull Up', 'Bodyweight', 'Back')");
            await db.runAsync("INSERT INTO exercises (name, type, muscle_group) VALUES ('Running', 'Cardio', 'Legs')");
        }
    }
};
