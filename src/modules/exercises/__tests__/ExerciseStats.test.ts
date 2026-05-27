import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePrincipal } from '@/src/data/principal'
import { createTestDb, getTestDb, resetTestDb, useTestDb, type TestDb } from '../../../test/setupTestDb'

vi.mock('@/src/db/client', () => ({
    getDb: async () => getTestDb(),
}))

const { ExerciseStats } = await import('../ExerciseStats')

let db: TestDb

const seedExercise = async (
    name: string,
    type: 'weight' | 'bodyweight' | 'bodyweight_timer' | 'cardio',
    userId: string | null = 'user-1'
): Promise<number> => {
    const result = await db.runAsync(
        `INSERT INTO exercises (uuid, user_id, name, type, sync_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'synced', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
        `ex-${name}`,
        userId,
        name,
        type
    )
    return result.lastInsertRowId
}

const seedWorkout = async (
    date: string,
    options: { status?: 'finished' | 'in_progress'; userId?: string | null; deletedAt?: string | null } = {}
): Promise<number> => {
    const { status = 'finished', userId = 'user-1', deletedAt = null } = options
    const result = await db.runAsync(
        `INSERT INTO workouts (uuid, user_id, date, start_time, status, deleted_at, sync_status, created_at, updated_at)
         VALUES (?, ?, ?, '08:00', ?, ?, 'synced', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
        `wo-${date}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        date,
        status,
        deletedAt
    )
    return result.lastInsertRowId
}

interface SetSeed {
    weight?: number | null
    reps?: number | null
    distance?: number | null
    duration?: number | null
    deletedAt?: string | null
    userId?: string | null
}

const seedSet = async (workoutId: number, exerciseId: number, position: number, seed: SetSeed): Promise<number> => {
    const { weight = null, reps = null, distance = null, duration = null, deletedAt = null, userId = 'user-1' } = seed
    const result = await db.runAsync(
        `INSERT INTO sets
         (uuid, user_id, workout_id, exercise_id, weight, reps, distance, duration, position, deleted_at, sync_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
        `set-${workoutId}-${position}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        workoutId,
        exerciseId,
        weight,
        reps,
        distance,
        duration,
        position,
        deletedAt
    )
    return result.lastInsertRowId
}

beforeEach(async () => {
    await resetTestDb()
    db = await createTestDb()
    useTestDb(db)
    setActivePrincipal({ mode: 'account', userId: 'user-1' })
})

describe('ExerciseStats.bestSetPerSession', () => {
    it('picks the heaviest set per day for weight-type, preserving reps', async () => {
        const exerciseId = await seedExercise('Bench', 'weight')
        const workoutId = await seedWorkout('2026-02-01')
        await seedSet(workoutId, exerciseId, 0, { weight: 80, reps: 8 })
        await seedSet(workoutId, exerciseId, 1, { weight: 100, reps: 5 })
        await seedSet(workoutId, exerciseId, 2, { weight: 90, reps: 6 })

        const series = await ExerciseStats.bestSetPerSession(exerciseId)

        expect(series).toHaveLength(1)
        expect(series[0]?.date).toBe('2026-02-01')
        expect(series[0]?.set.weight).toBe(100)
        expect(series[0]?.set.reps).toBe(5)
    })

    it('breaks weight ties with higher reps', async () => {
        const exerciseId = await seedExercise('Squat', 'weight')
        const workoutId = await seedWorkout('2026-02-02')
        await seedSet(workoutId, exerciseId, 0, { weight: 100, reps: 3 })
        await seedSet(workoutId, exerciseId, 1, { weight: 100, reps: 5 })

        const [entry] = await ExerciseStats.bestSetPerSession(exerciseId)

        expect(entry?.set.weight).toBe(100)
        expect(entry?.set.reps).toBe(5)
    })

    it('picks the highest-rep set for bodyweight, ignoring weight', async () => {
        const exerciseId = await seedExercise('PullUps', 'bodyweight')
        const workoutId = await seedWorkout('2026-02-03')
        await seedSet(workoutId, exerciseId, 0, { weight: 20, reps: 8 })
        await seedSet(workoutId, exerciseId, 1, { weight: 0, reps: 15 })

        const [entry] = await ExerciseStats.bestSetPerSession(exerciseId)

        expect(entry?.set.reps).toBe(15)
    })

    it('picks the longest-duration set for bodyweight_timer', async () => {
        const exerciseId = await seedExercise('Plank', 'bodyweight_timer')
        const workoutId = await seedWorkout('2026-02-04')
        await seedSet(workoutId, exerciseId, 0, { duration: 60 })
        await seedSet(workoutId, exerciseId, 1, { duration: 120 })
        await seedSet(workoutId, exerciseId, 2, { duration: 90 })

        const [entry] = await ExerciseStats.bestSetPerSession(exerciseId)

        expect(entry?.set.duration).toBe(120)
    })

    it('picks the longest-distance set for cardio, ties broken by duration', async () => {
        const exerciseId = await seedExercise('Run', 'cardio')
        const workoutId = await seedWorkout('2026-02-05')
        await seedSet(workoutId, exerciseId, 0, { distance: 5000, duration: 25 })
        await seedSet(workoutId, exerciseId, 1, { distance: 5000, duration: 30 })
        await seedSet(workoutId, exerciseId, 2, { distance: 4000, duration: 40 })

        const [entry] = await ExerciseStats.bestSetPerSession(exerciseId)

        expect(entry?.set.distance).toBe(5000)
        expect(entry?.set.duration).toBe(30)
    })

    it('returns one entry per date in ascending order across sessions', async () => {
        const exerciseId = await seedExercise('Bench2', 'weight')
        const wo1 = await seedWorkout('2026-03-01')
        const wo2 = await seedWorkout('2026-02-01')
        const wo3 = await seedWorkout('2026-04-01')
        await seedSet(wo1, exerciseId, 0, { weight: 100, reps: 5 })
        await seedSet(wo2, exerciseId, 0, { weight: 80, reps: 10 })
        await seedSet(wo3, exerciseId, 0, { weight: 110, reps: 3 })

        const series = await ExerciseStats.bestSetPerSession(exerciseId)

        expect(series.map((e) => e.date)).toEqual(['2026-02-01', '2026-03-01', '2026-04-01'])
    })

    it('excludes soft-deleted sets', async () => {
        const exerciseId = await seedExercise('BenchDel', 'weight')
        const workoutId = await seedWorkout('2026-02-06')
        await seedSet(workoutId, exerciseId, 0, { weight: 80, reps: 5 })
        await seedSet(workoutId, exerciseId, 1, { weight: 200, reps: 1, deletedAt: '2026-02-07T00:00:00Z' })

        const [entry] = await ExerciseStats.bestSetPerSession(exerciseId)

        expect(entry?.set.weight).toBe(80)
    })

    it('excludes sets from unfinished workouts', async () => {
        const exerciseId = await seedExercise('BenchUnfinished', 'weight')
        const finished = await seedWorkout('2026-02-08')
        const inProgress = await seedWorkout('2026-02-09', { status: 'in_progress' })
        await seedSet(finished, exerciseId, 0, { weight: 80, reps: 5 })
        await seedSet(inProgress, exerciseId, 0, { weight: 200, reps: 1 })

        const series = await ExerciseStats.bestSetPerSession(exerciseId)

        expect(series).toHaveLength(1)
        expect(series[0]?.date).toBe('2026-02-08')
        expect(series[0]?.set.weight).toBe(80)
    })

    it('excludes sets belonging to another principal', async () => {
        const exerciseId = await seedExercise('BenchScope', 'weight')
        const mineWorkout = await seedWorkout('2026-02-10', { userId: 'user-1' })
        const otherWorkout = await seedWorkout('2026-02-11', { userId: 'user-2' })
        await seedSet(mineWorkout, exerciseId, 0, { weight: 80, reps: 5, userId: 'user-1' })
        await seedSet(otherWorkout, exerciseId, 0, { weight: 200, reps: 1, userId: 'user-2' })

        const series = await ExerciseStats.bestSetPerSession(exerciseId)

        expect(series).toHaveLength(1)
        expect(series[0]?.date).toBe('2026-02-10')
        expect(series[0]?.set.weight).toBe(80)
    })

    it('returns empty when the exercise has no history', async () => {
        const exerciseId = await seedExercise('BenchEmpty', 'weight')

        const series = await ExerciseStats.bestSetPerSession(exerciseId)

        expect(series).toEqual([])
    })
})
