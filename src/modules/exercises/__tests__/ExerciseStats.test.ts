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

    it('picks the highest-rep set for unweighted bodyweight history', async () => {
        const exerciseId = await seedExercise('PullUps', 'bodyweight')
        const workoutId = await seedWorkout('2026-02-03')
        await seedSet(workoutId, exerciseId, 0, { weight: 0, reps: 8 })
        await seedSet(workoutId, exerciseId, 1, { weight: 0, reps: 15 })

        const [entry] = await ExerciseStats.bestSetPerSession(exerciseId)

        expect(entry?.set.reps).toBe(15)
    })

    it('still picks the highest-rep set for bodyweight when some sets carry added load', async () => {
        const exerciseId = await seedExercise('VestPullUps', 'bodyweight')
        const workoutId = await seedWorkout('2026-02-04')
        await seedSet(workoutId, exerciseId, 0, { weight: 0, reps: 15 })
        await seedSet(workoutId, exerciseId, 1, { weight: 10, reps: 8 })

        const [entry] = await ExerciseStats.bestSetPerSession(exerciseId)

        // Reps is always the bodyweight axis; the vest set with fewer reps does not win.
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

    it('picks the longest-distance set for distance-dominant cardio, ties broken by duration', async () => {
        const exerciseId = await seedExercise('Run', 'cardio')
        // Distance varies wildly across sessions, duration tracks it — distance is dominant.
        const wo1 = await seedWorkout('2026-02-05')
        const wo2 = await seedWorkout('2026-02-12')
        const wo3 = await seedWorkout('2026-02-19')
        await seedSet(wo1, exerciseId, 0, { distance: 1000, duration: 10 })
        await seedSet(wo2, exerciseId, 0, { distance: 5000, duration: 11 })
        await seedSet(wo3, exerciseId, 0, { distance: 9000, duration: 12 })
        // Tie-break case within the heaviest-distance session.
        await seedSet(wo3, exerciseId, 1, { distance: 9000, duration: 13 })

        const series = await ExerciseStats.bestSetPerSession(exerciseId)
        const best = series.find((e) => e.date === '2026-02-19')

        expect(best?.set.distance).toBe(9000)
        expect(best?.set.duration).toBe(13)
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

const exerciseRow = (id: number, type: 'weight' | 'bodyweight' | 'bodyweight_timer' | 'cardio', name: string) => ({
    id,
    name,
    type,
    position: 0,
})

describe('ExerciseStats.headlineStats', () => {
    it('returns the all-time max in the primary metric per exercise type', async () => {
        const weightId = await seedExercise('BenchHL', 'weight')
        const bodyId = await seedExercise('PullUpsHL', 'bodyweight')
        const cardioId = await seedExercise('RunHL', 'cardio')
        const timerId = await seedExercise('PlankHL', 'bodyweight_timer')

        const wo1 = await seedWorkout('2026-02-01')
        const wo2 = await seedWorkout('2026-02-02')
        await seedSet(wo1, weightId, 0, { weight: 80, reps: 8 })
        await seedSet(wo2, weightId, 0, { weight: 120, reps: 3 })
        await seedSet(wo1, bodyId, 0, { reps: 12 })
        await seedSet(wo2, bodyId, 0, { reps: 20 })
        await seedSet(wo1, cardioId, 0, { distance: 3000, duration: 18 })
        await seedSet(wo2, cardioId, 0, { distance: 5000, duration: 25 })
        await seedSet(wo1, timerId, 0, { duration: 1 })
        await seedSet(wo2, timerId, 0, { duration: 2 })

        const stats = await ExerciseStats.headlineStats([
            exerciseRow(weightId, 'weight', 'BenchHL'),
            exerciseRow(bodyId, 'bodyweight', 'PullUpsHL'),
            exerciseRow(cardioId, 'cardio', 'RunHL'),
            exerciseRow(timerId, 'bodyweight_timer', 'PlankHL'),
        ])

        expect(stats.get(weightId)?.value).toBe(120)
        expect(stats.get(weightId)?.formatted).toBe('120.00 kg')
        expect(stats.get(bodyId)?.value).toBe(20)
        expect(stats.get(bodyId)?.formatted).toBe('20 reps')
        expect(stats.get(cardioId)?.value).toBe(5000)
        expect(stats.get(cardioId)?.formatted).toBe('5.0km')
        expect(stats.get(timerId)?.value).toBe(2)
        expect(stats.get(timerId)?.formatted).toBe('2:00')
    })

    it('returns null for exercises with no history', async () => {
        const id = await seedExercise('EmptyHL', 'weight')

        const stats = await ExerciseStats.headlineStats([exerciseRow(id, 'weight', 'EmptyHL')])

        expect(stats.has(id)).toBe(true)
        expect(stats.get(id)).toBeNull()
    })

    it('returns one entry per requested exercise id', async () => {
        const a = await seedExercise('Aex', 'weight')
        const b = await seedExercise('Bex', 'weight')
        const c = await seedExercise('Cex', 'weight')
        const wo = await seedWorkout('2026-02-03')
        await seedSet(wo, a, 0, { weight: 50, reps: 5 })

        const stats = await ExerciseStats.headlineStats([
            exerciseRow(a, 'weight', 'Aex'),
            exerciseRow(b, 'weight', 'Bex'),
            exerciseRow(c, 'weight', 'Cex'),
        ])

        expect(Array.from(stats.keys()).sort()).toEqual([a, b, c].sort())
        expect(stats.get(a)?.value).toBe(50)
        expect(stats.get(b)).toBeNull()
        expect(stats.get(c)).toBeNull()
    })

    it('issues a single round trip regardless of exercise count', async () => {
        const a = await seedExercise('OneShotA', 'weight')
        const b = await seedExercise('OneShotB', 'bodyweight')
        const wo = await seedWorkout('2026-02-04')
        await seedSet(wo, a, 0, { weight: 60, reps: 4 })
        await seedSet(wo, b, 0, { reps: 10 })

        const spy = vi.spyOn(db, 'getAllAsync')
        await ExerciseStats.headlineStats([
            exerciseRow(a, 'weight', 'OneShotA'),
            exerciseRow(b, 'bodyweight', 'OneShotB'),
        ])

        expect(spy).toHaveBeenCalledTimes(1)
        spy.mockRestore()
    })

    it('excludes soft-deleted sets, unfinished workouts, and other principals', async () => {
        const id = await seedExercise('Scoped', 'weight')
        const mineFinished = await seedWorkout('2026-02-05', { userId: 'user-1' })
        const mineInProgress = await seedWorkout('2026-02-06', { status: 'in_progress', userId: 'user-1' })
        const others = await seedWorkout('2026-02-07', { userId: 'user-2' })
        await seedSet(mineFinished, id, 0, { weight: 70, reps: 5 })
        await seedSet(mineFinished, id, 1, { weight: 999, reps: 1, deletedAt: '2026-02-08T00:00:00Z' })
        await seedSet(mineInProgress, id, 0, { weight: 888, reps: 1 })
        await seedSet(others, id, 0, { weight: 777, reps: 1, userId: 'user-2' })

        const stats = await ExerciseStats.headlineStats([exerciseRow(id, 'weight', 'Scoped')])

        expect(stats.get(id)?.value).toBe(70)
    })

    it('returns an empty map for an empty exercise list without querying', async () => {
        const spy = vi.spyOn(db, 'getAllAsync')

        const stats = await ExerciseStats.headlineStats([])

        expect(stats.size).toBe(0)
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
    })
})

describe('ExerciseStats.sessionSummary', () => {
    it('returns max and avg of best-set-per-session for the dominant metric', async () => {
        const exerciseId = await seedExercise('BenchSummary', 'weight')
        const wo1 = await seedWorkout('2026-02-01')
        const wo2 = await seedWorkout('2026-02-02')
        const wo3 = await seedWorkout('2026-02-03')
        await seedSet(wo1, exerciseId, 0, { weight: 80, reps: 5 })
        await seedSet(wo1, exerciseId, 1, { weight: 100, reps: 5 })
        await seedSet(wo2, exerciseId, 0, { weight: 90, reps: 3 })
        await seedSet(wo3, exerciseId, 0, { weight: 110, reps: 2 })

        const summary = await ExerciseStats.sessionSummary(exerciseId)

        expect(summary?.dominantMetric).toBe('weight')
        expect(summary?.max).toBe(110)
        expect(summary?.avg).toBeCloseTo((100 + 90 + 110) / 3)
    })

    it('reports reps as dominant for bodyweight with no added weight', async () => {
        const exerciseId = await seedExercise('PullUpsSummary', 'bodyweight')
        const wo = await seedWorkout('2026-04-01')
        await seedSet(wo, exerciseId, 0, { reps: 12 })

        const summary = await ExerciseStats.sessionSummary(exerciseId)

        expect(summary?.dominantMetric).toBe('reps')
        expect(summary?.max).toBe(12)
        expect(summary?.avg).toBe(12)
    })

    it('treats cardio with bigger duration variance as duration-dominant and reports best as shortest time', async () => {
        const exerciseId = await seedExercise('Warmup1km', 'cardio')
        const wo1 = await seedWorkout('2026-06-01')
        const wo2 = await seedWorkout('2026-06-02')
        const wo3 = await seedWorkout('2026-06-03')
        // Constant ~1km distance, varying durations — fastest run is the best.
        await seedSet(wo1, exerciseId, 0, { distance: 1000, duration: 6 })
        await seedSet(wo2, exerciseId, 0, { distance: 1000, duration: 5 })
        await seedSet(wo3, exerciseId, 0, { distance: 1000, duration: 7 })

        const summary = await ExerciseStats.sessionSummary(exerciseId)

        expect(summary?.dominantMetric).toBe('duration')
        expect(summary?.max).toBe(5)
        expect(summary?.avg).toBeCloseTo((5 + 6 + 7) / 3)
        expect(summary?.contextAvgDistance).toBe(1000)
    })

    it('returns null when the exercise has no history', async () => {
        const exerciseId = await seedExercise('EmptySummary', 'weight')

        const summary = await ExerciseStats.sessionSummary(exerciseId)

        expect(summary).toBeNull()
    })

    it('excludes soft-deleted sets, unfinished workouts, and other principals', async () => {
        const exerciseId = await seedExercise('ScopedSummary', 'weight')
        const mineFinished = await seedWorkout('2026-05-01', { userId: 'user-1' })
        const mineInProgress = await seedWorkout('2026-05-02', { status: 'in_progress', userId: 'user-1' })
        const others = await seedWorkout('2026-05-03', { userId: 'user-2' })
        await seedSet(mineFinished, exerciseId, 0, { weight: 70, reps: 5 })
        await seedSet(mineFinished, exerciseId, 1, { weight: 999, reps: 1, deletedAt: '2026-05-04T00:00:00Z' })
        await seedSet(mineInProgress, exerciseId, 0, { weight: 888, reps: 1 })
        await seedSet(others, exerciseId, 0, { weight: 777, reps: 1, userId: 'user-2' })

        const summary = await ExerciseStats.sessionSummary(exerciseId)

        expect(summary?.max).toBe(70)
        expect(summary?.avg).toBe(70)
    })
})

describe('ExerciseStats.dominantMetric', () => {
    it('returns weight for weight-type exercises', async () => {
        const exerciseId = await seedExercise('BenchDom', 'weight')
        const wo = await seedWorkout('2026-02-01')
        await seedSet(wo, exerciseId, 0, { weight: 100, reps: 5 })

        expect(await ExerciseStats.dominantMetric(exerciseId)).toBe('weight')
    })

    it('returns reps for unweighted bodyweight history', async () => {
        const exerciseId = await seedExercise('PullUpsDom', 'bodyweight')
        const wo = await seedWorkout('2026-02-02')
        await seedSet(wo, exerciseId, 0, { reps: 12 })

        expect(await ExerciseStats.dominantMetric(exerciseId)).toBe('reps')
    })

    it('stays on reps for bodyweight even when sets carry added load (vest or assistance)', async () => {
        const vest = await seedExercise('VestPullUps', 'bodyweight')
        const assisted = await seedExercise('AssistedPullUps', 'bodyweight')
        const wo = await seedWorkout('2026-02-03')
        await seedSet(wo, vest, 0, { weight: 10, reps: 8 })
        await seedSet(wo, vest, 1, { weight: 0, reps: 12 })
        await seedSet(wo, assisted, 0, { weight: -20, reps: 8 })
        await seedSet(wo, assisted, 1, { weight: -10, reps: 6 })

        expect(await ExerciseStats.dominantMetric(vest)).toBe('reps')
        expect(await ExerciseStats.dominantMetric(assisted)).toBe('reps')
    })

    it('returns duration for unweighted bodyweight_timer history', async () => {
        const exerciseId = await seedExercise('PlankDom', 'bodyweight_timer')
        const wo = await seedWorkout('2026-02-04')
        await seedSet(wo, exerciseId, 0, { duration: 2 })

        expect(await ExerciseStats.dominantMetric(exerciseId)).toBe('duration')
    })

    it('stays on duration for bodyweight_timer even when sets carry vest load', async () => {
        const exerciseId = await seedExercise('WeightedPlank', 'bodyweight_timer')
        const wo = await seedWorkout('2026-02-05')
        await seedSet(wo, exerciseId, 0, { duration: 2 })
        await seedSet(wo, exerciseId, 1, { weight: 10, duration: 1.5 })

        expect(await ExerciseStats.dominantMetric(exerciseId)).toBe('duration')
    })

    it('returns distance for cardio with higher distance variance', async () => {
        const exerciseId = await seedExercise('LongRun', 'cardio')
        const wo1 = await seedWorkout('2026-02-06')
        const wo2 = await seedWorkout('2026-02-07')
        const wo3 = await seedWorkout('2026-02-08')
        await seedSet(wo1, exerciseId, 0, { distance: 3000, duration: 20 })
        await seedSet(wo2, exerciseId, 0, { distance: 5000, duration: 21 })
        await seedSet(wo3, exerciseId, 0, { distance: 8000, duration: 22 })

        expect(await ExerciseStats.dominantMetric(exerciseId)).toBe('distance')
    })

    it('returns duration for cardio with higher duration variance', async () => {
        const exerciseId = await seedExercise('FixedWarmup', 'cardio')
        const wo1 = await seedWorkout('2026-02-09')
        const wo2 = await seedWorkout('2026-02-10')
        const wo3 = await seedWorkout('2026-02-11')
        await seedSet(wo1, exerciseId, 0, { distance: 1000, duration: 5 })
        await seedSet(wo2, exerciseId, 0, { distance: 1000, duration: 6 })
        await seedSet(wo3, exerciseId, 0, { distance: 1000, duration: 8 })

        expect(await ExerciseStats.dominantMetric(exerciseId)).toBe('duration')
    })

    it('falls back to the type default when history is empty', async () => {
        const weight = await seedExercise('FallbackWeight', 'weight')
        const body = await seedExercise('FallbackBody', 'bodyweight')
        const timer = await seedExercise('FallbackTimer', 'bodyweight_timer')
        const cardio = await seedExercise('FallbackCardio', 'cardio')

        expect(await ExerciseStats.dominantMetric(weight)).toBe('weight')
        expect(await ExerciseStats.dominantMetric(body)).toBe('reps')
        expect(await ExerciseStats.dominantMetric(timer)).toBe('duration')
        expect(await ExerciseStats.dominantMetric(cardio)).toBe('distance')
    })

    it('returns null for a missing exercise', async () => {
        expect(await ExerciseStats.dominantMetric(99999)).toBeNull()
    })
})
