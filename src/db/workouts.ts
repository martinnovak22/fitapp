import { getDb } from './client';

export interface Workout {
    id: number;
    date: string;
    start_time: string;
    end_time?: string;
    status: 'in_progress' | 'finished';
    note?: string;
}

export interface Set {
    id: number;
    workout_id: number;
    exercise_id: number;
    weight?: number;
    reps?: number;
    distance?: number;
    duration?: number;
    rpe?: number;
}

export const WorkoutRepository = {
    async create(date: string): Promise<number> {
        const db = await getDb();
        const result = await db.runAsync(
            'INSERT INTO workouts (date, start_time, status) VALUES (?, ?, ?)',
            date, new Date().toISOString(), 'in_progress'
        );
        return result.lastInsertRowId;
    },

    async finish(id: number) {
        const db = await getDb();
        await db.runAsync(
            'UPDATE workouts SET end_time = ?, status = ? WHERE id = ?',
            new Date().toISOString(), 'finished', id
        );
    },

    async delete(id: number) {
        const db = await getDb();
        await db.runAsync('DELETE FROM workouts WHERE id = ?', id);
    },

    async addSet(workoutId: number, exerciseId: number, data: { weight?: number, reps?: number, distance?: number, duration?: number }) {
        const db = await getDb();
        await db.runAsync(
            'INSERT INTO sets (workout_id, exercise_id, weight, reps, distance, duration) VALUES (?, ?, ?, ?, ?, ?)',
            workoutId, exerciseId, data.weight ?? null, data.reps ?? null, data.distance ?? null, data.duration ?? null
        );
    },

    async getWorkoutsForDate(date: string): Promise<Workout[]> {
        const db = await getDb();
        return await db.getAllAsync('SELECT * FROM workouts WHERE date = ?', date);
    },

    async getActiveWorkout(): Promise<Workout | null> {
        const db = await getDb();
        const result = await db.getAllAsync<Workout>('SELECT * FROM workouts WHERE status = ? LIMIT 1', 'in_progress');
        return result.length > 0 ? result[0] : null;
    },

    async getAllWorkouts(): Promise<Workout[]> {
        const db = await getDb();
        return await db.getAllAsync('SELECT * FROM workouts ORDER BY date DESC, start_time DESC');
    },

    async getRecentWorkouts(limit: number = 3): Promise<Workout[]> {
        const db = await getDb();
        return await db.getAllAsync('SELECT * FROM workouts WHERE status = ? ORDER BY date DESC, start_time DESC LIMIT ?', 'finished', limit);
    },

    async getById(id: number): Promise<Workout | null> {
        const db = await getDb();
        const result = await db.getAllAsync<Workout>('SELECT * FROM workouts WHERE id = ?', id);
        return result.length > 0 ? result[0] : null;
    },

    async getWorkoutsForPeriod(startDate: string, endDate: string): Promise<Workout[]> {
        const db = await getDb();
        return await db.getAllAsync('SELECT * FROM workouts WHERE date >= ? AND date <= ? ORDER BY date ASC', startDate, endDate);
    },

    // Get all sets for a specific workout
    async getSets(workoutId: number): Promise<(Set & { exercise_name: string })[]> {
        const db = await getDb();
        return await db.getAllAsync(`
            SELECT s.*, e.name as exercise_name 
            FROM sets s 
            JOIN exercises e ON s.exercise_id = e.id 
            WHERE s.workout_id = ?
            ORDER BY s.id ASC
        `, workoutId);
    },

    async deleteSet(setId: number) {
        const db = await getDb();
        await db.runAsync('DELETE FROM sets WHERE id = ?', setId);
    }
};
