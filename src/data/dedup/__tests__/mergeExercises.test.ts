import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb, getTestDb, resetTestDb, type TestDb, useTestDb } from '@/src/test/setupTestDb'

vi.mock('@/src/db/client', () => ({
    getDb: async () => getTestDb(),
}))

const invalidateExercisesCache = vi.fn()
vi.mock('@/src/data/exercisesCache', () => ({
    invalidateExercisesCache: () => invalidateExercisesCache(),
}))

const { getExerciseSetCounts, mergeDuplicateExercises, findDuplicateExercises } = await import('../mergeExercises')
const { setActivePrincipal } = await import('@/src/data/principal')

let db: TestDb

beforeEach(async () => {
    await resetTestDb()
    db = await createTestDb()
    useTestDb(db)
    setActivePrincipal({ mode: 'account', userId: 'user-A' })
    invalidateExercisesCache.mockClear()
})

const insertExercise = async (
    uuid: string,
    name: string,
    userId: string | null = 'user-A',
    createdAt = '2026-01-01T00:00:00Z'
) => {
    const result = await db.runAsync(
        `INSERT INTO exercises (uuid, user_id, name, type, position, sync_status, created_at, updated_at)
         VALUES (?, ?, ?, 'weight', 0, 'synced', ?, ?)`,
        uuid,
        userId,
        name,
        createdAt,
        createdAt
    )
    return result.lastInsertRowId
}

const insertWorkout = async (uuid: string, userId: string | null = 'user-A') => {
    const result = await db.runAsync(
        `INSERT INTO workouts (uuid, user_id, date, status, sync_status, created_at, updated_at)
         VALUES (?, ?, '2026-01-01', 'finished', 'synced', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
        uuid,
        userId
    )
    return result.lastInsertRowId
}

const insertSet = async (
    uuid: string,
    workoutId: number,
    exerciseId: number,
    userId: string | null = 'user-A',
    deletedAt: string | null = null
) => {
    const result = await db.runAsync(
        `INSERT INTO sets (uuid, user_id, workout_id, exercise_id, position, sync_status, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, 0, 'synced', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ?)`,
        uuid,
        userId,
        workoutId,
        exerciseId,
        deletedAt
    )
    return result.lastInsertRowId
}

describe('getExerciseSetCounts', () => {
    it('counts live sets per exercise within the active principal scope', async () => {
        const bench = await insertExercise('ex-bench', 'Bench Press')
        const squat = await insertExercise('ex-squat', 'Squat')
        const workout = await insertWorkout('w-1')
        await insertSet('s-1', workout, bench)
        await insertSet('s-2', workout, bench)
        await insertSet('s-3', workout, squat)
        // A soft-deleted set must not be counted.
        await insertSet('s-deleted', workout, bench, 'user-A', '2026-02-01T00:00:00Z')
        // Another principal's set must not be counted.
        await insertSet('s-other', workout, bench, 'user-B')

        const counts = await getExerciseSetCounts()
        expect(counts.get(bench)).toBe(2)
        expect(counts.get(squat)).toBe(1)
    })
})

const setRow = async (uuid: string) =>
    db.getFirstAsync<{ exercise_id: number; sync_status: string }>(
        `SELECT exercise_id, sync_status FROM sets WHERE uuid = ?`,
        uuid
    )

describe('mergeDuplicateExercises', () => {
    it('re-points the duplicate’s Sets onto the survivor and marks them dirty', async () => {
        const survivor = await insertExercise('ex-survivor', 'Bench Press')
        const duplicate = await insertExercise('ex-dup', 'Bench Press')
        const workout = await insertWorkout('w-1')
        await insertSet('s-1', workout, duplicate)
        await insertSet('s-2', workout, duplicate)

        const result = await mergeDuplicateExercises({ survivorId: survivor, duplicateIds: [duplicate] })

        expect(result.setsRepointed).toBe(2)
        expect((await setRow('s-1'))?.exercise_id).toBe(survivor)
        expect((await setRow('s-2'))?.exercise_id).toBe(survivor)
        expect((await setRow('s-1'))?.sync_status).toBe('dirty')
    })

    it('deletes each duplicate with a tombstone while leaving the survivor and re-pointed Sets intact', async () => {
        const survivor = await insertExercise('ex-survivor', 'Bench Press')
        const duplicate = await insertExercise('ex-dup', 'Bench Press')
        const workout = await insertWorkout('w-1')
        await insertSet('s-1', workout, duplicate)

        const result = await mergeDuplicateExercises({ survivorId: survivor, duplicateIds: [duplicate] })

        expect(result.exercisesDeleted).toBe(1)
        // Duplicate row is gone; survivor remains.
        const exRows = await db.getAllAsync<{ id: number }>(`SELECT id FROM exercises`)
        expect(exRows.map((r) => r.id)).toEqual([survivor])
        // The Set survived (re-point ran before delete, so the cascade did not fire).
        expect((await setRow('s-1'))?.exercise_id).toBe(survivor)
        // A dirty tombstone records the duplicate's uuid for propagation.
        const tomb = await db.getFirstAsync<{ entity_uuid: string; sync_status: string }>(
            `SELECT entity_uuid, sync_status FROM deletion_tombstones WHERE entity_type = 'exercise'`
        )
        expect(tomb?.entity_uuid).toBe('ex-dup')
        expect(tomb?.sync_status).toBe('dirty')
    })

    it('is a no-op when no duplicate ids remain after excluding the survivor', async () => {
        const survivor = await insertExercise('ex-survivor', 'Bench Press')
        const workout = await insertWorkout('w-1')
        await insertSet('s-1', workout, survivor)

        const result = await mergeDuplicateExercises({ survivorId: survivor, duplicateIds: [survivor] })

        expect(result).toEqual({ setsRepointed: 0, exercisesDeleted: 0 })
        expect((await setRow('s-1'))?.sync_status).toBe('synced')
        expect(invalidateExercisesCache).not.toHaveBeenCalled()
    })

    it('invalidates the exercises cache so the merged-away duplicate leaves the UI', async () => {
        const survivor = await insertExercise('ex-survivor', 'Bench Press')
        const duplicate = await insertExercise('ex-dup', 'Bench Press')

        await mergeDuplicateExercises({ survivorId: survivor, duplicateIds: [duplicate] })

        expect(invalidateExercisesCache).toHaveBeenCalled()
    })

    it('back-fills a photo and muscle group the survivor lacks from a loser', async () => {
        const survivor = await insertExercise('ex-survivor', 'Bench Press')
        const duplicate = await insertExercise('ex-dup', 'Bench Press')
        await db.runAsync(
            `UPDATE exercises SET photo_uri = 'file:///dup.jpg', muscle_group = 'chest' WHERE id = ?`,
            duplicate
        )

        await mergeDuplicateExercises({ survivorId: survivor, duplicateIds: [duplicate] })

        const kept = await db.getFirstAsync<{
            photo_uri: string | null
            photo_key: string | null
            muscle_group: string | null
            sync_status: string
        }>(`SELECT photo_uri, photo_key, muscle_group, sync_status FROM exercises WHERE id = ?`, survivor)
        expect(kept?.photo_uri).toBe('file:///dup.jpg')
        expect(kept?.photo_key).toBe('ex-survivor-dup.jpg')
        expect(kept?.muscle_group).toBe('chest')
        expect(kept?.sync_status).toBe('dirty')
    })

    it('keeps the survivor’s own photo and muscle group when it already has them', async () => {
        const survivor = await insertExercise('ex-survivor', 'Bench Press')
        const duplicate = await insertExercise('ex-dup', 'Bench Press')
        await db.runAsync(
            `UPDATE exercises SET photo_uri = 'file:///keep.jpg', muscle_group = 'chest' WHERE id = ?`,
            survivor
        )
        await db.runAsync(
            `UPDATE exercises SET photo_uri = 'file:///dup.jpg', muscle_group = 'back' WHERE id = ?`,
            duplicate
        )

        await mergeDuplicateExercises({ survivorId: survivor, duplicateIds: [duplicate] })

        const kept = await db.getFirstAsync<{ photo_uri: string | null; muscle_group: string | null }>(
            `SELECT photo_uri, muscle_group FROM exercises WHERE id = ?`,
            survivor
        )
        expect(kept?.photo_uri).toBe('file:///keep.jpg')
        expect(kept?.muscle_group).toBe('chest')
    })

    it('never touches another principal’s rows, even if their ids are passed in', async () => {
        const survivor = await insertExercise('ex-survivor', 'Bench Press')
        const foreignDup = await insertExercise('ex-foreign', 'Bench Press', 'user-B')
        const workout = await insertWorkout('w-b', 'user-B')
        await insertSet('s-foreign', workout, foreignDup, 'user-B')

        const result = await mergeDuplicateExercises({ survivorId: survivor, duplicateIds: [foreignDup] })

        expect(result.setsRepointed).toBe(0)
        expect(result.exercisesDeleted).toBe(0)
        // The foreign exercise and its Set are untouched.
        expect((await setRow('s-foreign'))?.exercise_id).toBe(foreignDup)
        const foreignStill = await db.getFirstAsync<{ id: number }>(
            `SELECT id FROM exercises WHERE uuid = 'ex-foreign'`
        )
        expect(foreignStill?.id).toBe(foreignDup)
        const tombCount = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) c FROM deletion_tombstones`)
        expect(tombCount?.c).toBe(0)
    })
})

describe('findDuplicateExercises', () => {
    it('returns the active principal’s Duplicate Groups with Set counts feeding survivor selection', async () => {
        // Equal created_at, so the survivor is decided by the most referencing Sets.
        const fewer = await insertExercise('ex-fewer', 'Bench Press', 'user-A')
        const more = await insertExercise('ex-more', 'Bench Press', 'user-A')
        await insertExercise('ex-squat', 'Squat', 'user-A')
        const workout = await insertWorkout('w-1')
        await insertSet('s-1', workout, fewer)
        await insertSet('s-2', workout, more)
        await insertSet('s-3', workout, more)

        const groups = await findDuplicateExercises()

        expect(groups).toHaveLength(1)
        expect(groups[0].normalizedName).toBe('bench press')
        expect(groups[0].survivor.id).toBe(more)
    })
})
