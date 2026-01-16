import { getDb } from './client';

export type ExerciseType = 'weight' | 'cardio' | 'bodyweight';

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
            name, type, muscleGroup ?? null
        );
        return result.lastInsertRowId;
    },

    async delete(id: number) {
        const db = await getDb();
        await db.runAsync('DELETE FROM exercises WHERE id = ?', id);
    },

    // Seed some initial data if empty
    async seedDefaults() {
        const db = await getDb();

        await db.runAsync("DELETE FROM exercises WHERE name IN ('Squat', 'Deadlift')");

        const existing = await db.getAllAsync('SELECT id FROM exercises LIMIT 1');
        if (existing.length === 0) {
            await db.runAsync("INSERT INTO exercises (name, type, muscle_group) VALUES ('Bench Press', 'weight', 'chest')");
            await db.runAsync("INSERT INTO exercises (name, type, muscle_group) VALUES ('Pull Up', 'bodyweight', 'back')");
            await db.runAsync("INSERT INTO exercises (name, type, muscle_group) VALUES ('Running', 'cardio', 'legs')");
        }
    }
};
