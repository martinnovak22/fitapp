// The read-side queries behind previous performance, personal records and the
// History tab: only live rows of the active principal count.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb, getTestDb, resetTestDb, type TestDb, useTestDb } from '@/src/test/setupTestDb'

vi.mock('@/src/db/client', () => ({
    getDb: async () => getTestDb(),
}))

const { WorkoutRepository } = await import('../workouts')
const { setActivePrincipal } = await import('@/src/data/principal')

let db: TestDb

beforeEach(async () => {
    await resetTestDb()
    db = await createTestDb()
    useTestDb(db)
    setActivePrincipal({ mode: 'account', userId: 'user-A' })
})

const STAMP = '2026-01-01T00:00:00Z'

const insertWorkout = async (
    uuid: string,
    status: 'finished' | 'in_progress',
    opts: { userId?: string; deletedAt?: string | null; date?: string } = {}
) => {
    const result = await db.runAsync(
        `INSERT INTO workouts (uuid, user_id, date, start_time, status, created_at, updated_at, sync_status, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
        uuid,
        opts.userId ?? 'user-A',
        opts.date ?? '2026-10-01',
        STAMP,
        status,
        STAMP,
        STAMP,
        opts.deletedAt ?? null
    )
    return result.lastInsertRowId
}

const insertExercise = async (uuid: string) => {
    const result = await db.runAsync(
        `INSERT INTO exercises (uuid, user_id, name, type, position, sync_status, created_at, updated_at)
         VALUES (?, 'user-A', ?, 'weight', 0, 'synced', ?, ?)`,
        uuid,
        uuid,
        STAMP,
        STAMP
    )
    return result.lastInsertRowId
}

const insertSet = async (workoutId: number, exerciseId: number, weight: number, userId = 'user-A') => {
    await db.runAsync(
        `INSERT INTO sets (uuid, user_id, workout_id, exercise_id, weight, reps, position, created_at, updated_at, sync_status)
         VALUES (?, ?, ?, ?, ?, 5, 0, ?, ?, 'synced')`,
        `set-${workoutId}-${exerciseId}-${weight}`,
        userId,
        workoutId,
        exerciseId,
        weight,
        STAMP,
        STAMP
    )
}

describe('WorkoutRepository.getFinishedExerciseSets', () => {
    it('returns sets of finished workouts with their date, leaving out the current, unfinished and deleted ones', async () => {
        const bench = await insertExercise('bench')
        const row = await insertExercise('row')
        const done = await insertWorkout('w-done', 'finished', { date: '2026-10-02' })
        const current = await insertWorkout('w-current', 'in_progress')
        const otherRunning = await insertWorkout('w-running', 'in_progress')
        const deleted = await insertWorkout('w-deleted', 'finished', { deletedAt: STAMP })
        await insertSet(done, bench, 60)
        await insertSet(done, row, 40)
        await insertSet(current, bench, 70)
        await insertSet(otherRunning, bench, 80)
        await insertSet(deleted, bench, 90)

        const rows = await WorkoutRepository.getFinishedExerciseSets([bench], current)

        expect(rows.map((r) => [r.exercise_id, r.weight, r.workout_date])).toEqual([[bench, 60, '2026-10-02']])
    })

    it("ignores another principal's workouts and returns nothing for no exercises", async () => {
        const bench = await insertExercise('bench')
        const theirs = await insertWorkout('w-theirs', 'finished', { userId: 'user-B' })
        await insertSet(theirs, bench, 100, 'user-B')

        expect(await WorkoutRepository.getFinishedExerciseSets([bench], -1)).toEqual([])
        expect(await WorkoutRepository.getFinishedExerciseSets([], -1)).toEqual([])
    })
})

describe('WorkoutRepository.getAllSetRows', () => {
    it("returns live sets of live workouts with their exercise, leaving out deleted and other principals' rows", async () => {
        const bench = await insertExercise('bench')
        const mine = await insertWorkout('w-mine', 'finished')
        const running = await insertWorkout('w-running', 'in_progress')
        const deleted = await insertWorkout('w-deleted', 'finished', { deletedAt: STAMP })
        const theirs = await insertWorkout('w-theirs', 'finished', { userId: 'user-B' })
        await insertSet(mine, bench, 60)
        await insertSet(running, bench, 65)
        await insertSet(deleted, bench, 70)
        await insertSet(theirs, bench, 75, 'user-B')

        const rows = await WorkoutRepository.getAllSetRows()

        expect(rows.map((r) => [r.workout_id, r.weight, r.exercise_name, r.exercise_type])).toEqual([
            [mine, 60, 'bench', 'weight'],
            [running, 65, 'bench', 'weight'],
        ])
    })
})

describe('WorkoutRepository.addSet and updateSetPositions', () => {
    it('returns the new uuid and stores a shown order', async () => {
        const workout = await insertWorkout('w-live', 'in_progress')
        const bench = await insertExercise('ex-bench')
        const first = await WorkoutRepository.addSet(workout, bench, { weight: 60, reps: 8 })
        const second = await WorkoutRepository.addSet(workout, bench, { weight: 70, reps: 6 })
        expect(first).not.toBe(second)

        const before = await WorkoutRepository.getSets(workout)
        expect(before.map((s) => s.uuid)).toEqual([first, second])

        const [a, b] = before
        await WorkoutRepository.updateSetPositions([
            { id: a.id, position: b.position },
            { id: b.id, position: a.position },
        ])
        const after = await WorkoutRepository.getSets(workout)
        expect(after.map((s) => s.uuid)).toEqual([second, first])
        expect(after.every((s) => s.sync_status === 'dirty')).toBe(true)
    })
})
