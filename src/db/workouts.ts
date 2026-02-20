import { getDb } from './client';
import { createEntityUuid, nowIso, recordDeletionTombstone, SyncStatus } from './sync';
import { executeWrite, executeWriteTransaction } from './writeQueue';

export interface Workout {
    id: number;
    uuid?: string;
    user_id?: string | null;
    date: string;
    start_time: string;
    end_time?: string;
    status: 'in_progress' | 'finished';
    note?: string;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
    sync_status?: SyncStatus;
    last_synced_at?: string | null;
}

export interface SubSet {
    weight?: number;
    reps?: number;
    distance?: number;
    duration?: number;
}

export interface Set {
    id: number;
    uuid?: string;
    user_id?: string | null;
    workout_id: number;
    exercise_id: number;
    weight?: number;
    reps?: number;
    distance?: number;
    duration?: number;
    rpe?: number;
    position: number;
    sub_sets?: string; // JSON string
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
    sync_status?: SyncStatus;
    last_synced_at?: string | null;
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
        return executeWrite(async (db) => {
            const now = nowIso();
            const result = await db.runAsync(
                `INSERT INTO workouts
                 (uuid, date, start_time, status, created_at, updated_at, sync_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                createEntityUuid(),
                date,
                now,
                'in_progress',
                now,
                now,
                'dirty'
            );
            return result.lastInsertRowId;
        });
    },

    async finish(id: number): Promise<void> {
        await executeWrite((db) => {
            const now = nowIso();
            return db.runAsync(
                'UPDATE workouts SET end_time = ?, status = ?, updated_at = ?, sync_status = ? WHERE id = ?',
                now,
                'finished',
                now,
                'dirty',
                id
            );
        });
    },

    async delete(id: number): Promise<void> {
        await executeWriteTransaction(async (db) => {
            const entity = await db.getFirstAsync<{ uuid: string; user_id?: string | null }>(
                'SELECT uuid, user_id FROM workouts WHERE id = ?',
                id
            );
            if (entity?.uuid) {
                await recordDeletionTombstone(db, 'workout', entity.uuid, entity.user_id);
            }
            await db.runAsync('DELETE FROM workouts WHERE id = ?', id);
        });
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
        await executeWriteTransaction(async (db) => {
            const lastSet = await db.getFirstAsync<{ position: number }>(
                'SELECT position FROM sets WHERE workout_id = ? ORDER BY position DESC LIMIT 1',
                workoutId
            );
            const nextPosition = lastSet ? lastSet.position + 1 : 0;
            const now = nowIso();

            await db.runAsync(
                `INSERT INTO sets
                 (uuid, workout_id, exercise_id, weight, reps, distance, duration, position, sub_sets, created_at, updated_at, sync_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                createEntityUuid(),
                workoutId,
                exerciseId,
                data.weight ?? null,
                data.reps ?? null,
                data.distance ?? null,
                data.duration ?? null,
                nextPosition,
                data.sub_sets ?? null,
                now,
                now,
                'dirty'
            );
        });
    },

    async updateSet(setId: number, data: SetData): Promise<void> {
        await executeWrite((db) => db.runAsync(
            'UPDATE sets SET weight = ?, reps = ?, distance = ?, duration = ?, sub_sets = ?, updated_at = ?, sync_status = ? WHERE id = ?',
            data.weight ?? null,
            data.reps ?? null,
            data.distance ?? null,
            data.duration ?? null,
            data.sub_sets ?? null,
            nowIso(),
            'dirty',
            setId
        ));
    },

    async deleteSet(setId: number): Promise<void> {
        await executeWriteTransaction(async (db) => {
            const entity = await db.getFirstAsync<{ uuid: string; user_id?: string | null }>(
                'SELECT uuid, user_id FROM sets WHERE id = ?',
                setId
            );
            if (entity?.uuid) {
                await recordDeletionTombstone(db, 'set', entity.uuid, entity.user_id);
            }
            await db.runAsync('DELETE FROM sets WHERE id = ?', setId);
        });
    },

    async updateSetPosition(setId: number, position: number): Promise<void> {
        await executeWrite((db) => db.runAsync(
            'UPDATE sets SET position = ?, updated_at = ?, sync_status = ? WHERE id = ?',
            position,
            nowIso(),
            'dirty',
            setId
        ));
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
