import { getDb } from './client';

export interface Workout {
    id: number;
    date: string;
    start_time: string;
    end_time?: string;
    status: 'in_progress' | 'finished';
    note?: string;
}

export interface SubSet {
    weight?: number;
    reps?: number;
    distance?: number;
    duration?: number;
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
    position: number;
    sub_sets?: string; // JSON string
}

export interface SetData {
    weight?: number;
    reps?: number;
    distance?: number;
    duration?: number;
    sub_sets?: string; // JSON string
}

export interface ExerciseHistory {
    date: string;
    max_weight: number;
    max_reps: number;
    max_distance: number;
    max_duration: number;
}

export interface SetWithExerciseName extends Set {
    exercise_name: string;
}

export const WorkoutRepository = {
    async create(date: string): Promise<number> {
        const db = await getDb();
        const result = await db.runAsync(
            'INSERT INTO workouts (date, start_time, status) VALUES (?, ?, ?)',
            date,
            new Date().toISOString(),
            'in_progress'
        );
        return result.lastInsertRowId;
    },

    async finish(id: number): Promise<void> {
        const db = await getDb();
        await db.runAsync(
            'UPDATE workouts SET end_time = ?, status = ? WHERE id = ?',
            new Date().toISOString(),
            'finished',
            id
        );
    },

    async delete(id: number): Promise<void> {
        const db = await getDb();
        await db.runAsync('DELETE FROM workouts WHERE id = ?', id);
    },

    async getById(id: number): Promise<Workout | null> {
        const db = await getDb();
        const result = await db.getFirstAsync<Workout>(
            'SELECT * FROM workouts WHERE id = ?',
            id
        );
        return result ?? null;
    },

    async getActiveWorkout(): Promise<Workout | null> {
        const db = await getDb();
        const result = await db.getFirstAsync<Workout>(
            'SELECT * FROM workouts WHERE status = ? LIMIT 1',
            'in_progress'
        );
        return result ?? null;
    },

    async getAllWorkouts(): Promise<Workout[]> {
        const db = await getDb();
        return await db.getAllAsync<Workout>(
            'SELECT * FROM workouts ORDER BY date DESC, start_time DESC'
        );
    },

    async getWorkoutsForDate(date: string): Promise<Workout[]> {
        const db = await getDb();
        return await db.getAllAsync<Workout>(
            'SELECT * FROM workouts WHERE date = ?',
            date
        );
    },

    async getWorkoutsForPeriod(startDate: string, endDate: string): Promise<Workout[]> {
        const db = await getDb();
        return await db.getAllAsync<Workout>(
            'SELECT * FROM workouts WHERE date >= ? AND date <= ? ORDER BY date ASC',
            startDate,
            endDate
        );
    },

    async getRecentWorkouts(limit: number = 3): Promise<Workout[]> {
        const db = await getDb();
        return await db.getAllAsync<Workout>(
            'SELECT * FROM workouts WHERE status = ? ORDER BY date DESC, start_time DESC LIMIT ?',
            'finished',
            limit
        );
    },

    async addSet(workoutId: number, exerciseId: number, data: SetData): Promise<void> {
        const db = await getDb();

        const lastSet = await db.getFirstAsync<{ position: number }>(
            'SELECT position FROM sets WHERE workout_id = ? ORDER BY position DESC LIMIT 1',
            workoutId
        );
        const nextPosition = lastSet ? lastSet.position + 1 : 0;

        await db.runAsync(
            'INSERT INTO sets (workout_id, exercise_id, weight, reps, distance, duration, position, sub_sets) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            workoutId,
            exerciseId,
            data.weight ?? null,
            data.reps ?? null,
            data.distance ?? null,
            data.duration ?? null,
            nextPosition,
            data.sub_sets ?? null
        );
    },

    async updateSet(setId: number, data: SetData): Promise<void> {
        const db = await getDb();
        await db.runAsync(
            'UPDATE sets SET weight = ?, reps = ?, distance = ?, duration = ?, sub_sets = ? WHERE id = ?',
            data.weight ?? null,
            data.reps ?? null,
            data.distance ?? null,
            data.duration ?? null,
            data.sub_sets ?? null,
            setId
        );
    },

    async deleteSet(setId: number): Promise<void> {
        const db = await getDb();
        await db.runAsync('DELETE FROM sets WHERE id = ?', setId);
    },

    async updateSetPosition(setId: number, position: number): Promise<void> {
        const db = await getDb();
        await db.runAsync(
            'UPDATE sets SET position = ? WHERE id = ?',
            position,
            setId
        );
    },

    async getSets(workoutId: number): Promise<SetWithExerciseName[]> {
        const db = await getDb();
        return await db.getAllAsync<SetWithExerciseName>(
            `SELECT s.*, e.name as exercise_name
             FROM sets s
             JOIN exercises e ON s.exercise_id = e.id
             WHERE s.workout_id = ?
             ORDER BY s.position ASC, s.id ASC`,
            workoutId
        );
    },

    async getExerciseHistory(exerciseId: number): Promise<ExerciseHistory[]> {
        const db = await getDb();
        return await db.getAllAsync<ExerciseHistory>(
            `SELECT
                w.date,
                MAX(s.weight) as max_weight,
                MAX(s.reps) as max_reps,
                MAX(s.distance) as max_distance,
                MAX(s.duration) as max_duration
             FROM sets s
             JOIN workouts w ON s.workout_id = w.id
             WHERE s.exercise_id = ? AND w.status = 'finished'
             GROUP BY w.date
             ORDER BY w.date ASC`,
            exerciseId
        );
    },


    async getWorkoutCountForMonth(month: string): Promise<number> {
        // month: YYYY-MM
        const db = await getDb();
        const result = await db.getFirstAsync<{ count: number }>(
            "SELECT COUNT(*) as count FROM workouts WHERE date LIKE ? AND status = 'finished'",
            `${month}%`
        );
        return result?.count ?? 0;
    },


    async getAvgWorkoutDuration(month: string): Promise<number> {
        const db = await getDb();
        const result = await db.getFirstAsync<{ avg_duration: number }>(
            `SELECT AVG(unix_duration) as avg_duration
             FROM (
                SELECT (strftime('%s', end_time) - strftime('%s', start_time)) / 60 as unix_duration
                FROM workouts
                WHERE date LIKE ? AND status = 'finished' AND end_time IS NOT NULL
             )`,
            `${month}%`
        );
        return result?.avg_duration ?? 0;
    },
};
