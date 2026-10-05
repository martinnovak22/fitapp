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

    it('soft-deletes each duplicate with a tombstone while leaving the survivor and re-pointed Sets intact', async () => {
        const survivor = await insertExercise('ex-survivor', 'Bench Press')
        const duplicate = await insertExercise('ex-dup', 'Bench Press')
        const workout = await insertWorkout('w-1')
        await insertSet('s-1', workout, duplicate)

        const result = await mergeDuplicateExercises({ survivorId: survivor, duplicateIds: [duplicate] })

        expect(result.exercisesDeleted).toBe(1)
        // The duplicate stays as a soft-deleted row (so a Set another device
        // logs against it still links on pull); only the survivor is live.
        const exRows = await db.getAllAsync<{ id: number; deleted_at: string | null }>(
            `SELECT id, deleted_at FROM exercises ORDER BY id`
        )
        expect(exRows).toEqual([
            { id: survivor, deleted_at: null },
            { id: duplicate, deleted_at: expect.any(String) },
        ])
        expect((await setRow('s-1'))?.exercise_id).toBe(survivor)
        // A dirty tombstone records the duplicate's uuid for propagation.
        const tomb = await db.getFirstAsync<{ entity_uuid: string; sync_status: string }>(
            `SELECT entity_uuid, sync_status FROM deletion_tombstones WHERE entity_type = 'exercise'`
        )
        expect(tomb?.entity_uuid).toBe('ex-dup')
        expect(tomb?.sync_status).toBe('dirty')
    })

    it('is a no-op when the survivor was deleted meanwhile', async () => {
        const survivor = await insertExercise('ex-survivor', 'Bench Press')
        const duplicate = await insertExercise('ex-dup', 'Bench Press')
        const workout = await insertWorkout('w-1')
        await insertSet('s-1', workout, duplicate)
        await db.runAsync(`UPDATE exercises SET deleted_at = '2026-02-01T00:00:00Z' WHERE id = ?`, survivor)

        const result = await mergeDuplicateExercises({ survivorId: survivor, duplicateIds: [duplicate] })

        expect(result).toEqual({ setsRepointed: 0, exercisesDeleted: 0, templatesRepointed: 0 })
        expect((await setRow('s-1'))?.exercise_id).toBe(duplicate)
        const dup = await db.getFirstAsync<{ deleted_at: string | null }>(
            'SELECT deleted_at FROM exercises WHERE id = ?',
            duplicate
        )
        expect(dup?.deleted_at).toBeNull()
    })

    it('is a no-op when no duplicate ids remain after excluding the survivor', async () => {
        const survivor = await insertExercise('ex-survivor', 'Bench Press')
        const workout = await insertWorkout('w-1')
        await insertSet('s-1', workout, survivor)

        const result = await mergeDuplicateExercises({ survivorId: survivor, duplicateIds: [survivor] })

        expect(result).toEqual({ setsRepointed: 0, exercisesDeleted: 0, templatesRepointed: 0 })
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

describe('mergeDuplicateExercises — taxonomy back-fill (ADR-0007)', () => {
    it('gives a survivor that resolves to no Muscle the duplicate’s Muscles (as one unit) and its Equipment', async () => {
        const survivor = await insertExercise('ex-keep', 'Bench Press')
        await db.runAsync(`UPDATE exercises SET muscle_group = 'posilovna' WHERE id = ?`, survivor)
        const dup = await insertExercise('ex-dup', 'Bench Press')
        await db.runAsync(
            `UPDATE exercises SET muscle_group = 'chest', primary_muscle = 'chest',
                    secondary_muscles = '["triceps"]', equipment = 'barbell' WHERE id = ?`,
            dup
        )

        await mergeDuplicateExercises({ survivorId: survivor, duplicateIds: [dup] })

        const row = await db.getFirstAsync<Record<string, unknown>>(
            'SELECT muscle_group, primary_muscle, secondary_muscles, equipment, sync_status FROM exercises WHERE id = ?',
            survivor
        )
        expect(row).toEqual({
            muscle_group: 'chest',
            primary_muscle: 'chest',
            secondary_muscles: '["triceps"]',
            equipment: 'barbell',
            sync_status: 'dirty',
        })
    })

    it('keeps a survivor’s Muscles that an older client edited after the keys were set', async () => {
        const survivor = await insertExercise('ex-keep', 'Curl')
        // Stored keys say lats, but an older app version since retyped the group.
        await db.runAsync(
            `UPDATE exercises SET primary_muscle = 'lats', muscle_group = 'biceps' WHERE id = ?`,
            survivor
        )
        const dup = await insertExercise('ex-dup', 'Curl')
        await db.runAsync(`UPDATE exercises SET primary_muscle = 'chest', muscle_group = 'chest' WHERE id = ?`, dup)

        await mergeDuplicateExercises({ survivorId: survivor, duplicateIds: [dup] })

        const row = await db.getFirstAsync<{ muscle_group: string; primary_muscle: string }>(
            'SELECT muscle_group, primary_muscle FROM exercises WHERE id = ?',
            survivor
        )
        expect(row).toEqual({ muscle_group: 'biceps', primary_muscle: 'lats' })
    })

    it('does not overwrite a survivor whose legacy text maps to a Muscle', async () => {
        const survivor = await insertExercise('ex-keep', 'Row')
        await db.runAsync(`UPDATE exercises SET muscle_group = 'záda' WHERE id = ?`, survivor)
        const dup = await insertExercise('ex-dup', 'Row')
        await db.runAsync(`UPDATE exercises SET primary_muscle = 'chest', muscle_group = 'chest' WHERE id = ?`, dup)

        await mergeDuplicateExercises({ survivorId: survivor, duplicateIds: [dup] })

        const row = await db.getFirstAsync<{ muscle_group: string; primary_muscle: string | null }>(
            'SELECT muscle_group, primary_muscle FROM exercises WHERE id = ?',
            survivor
        )
        expect(row).toEqual({ muscle_group: 'záda', primary_muscle: null })
    })

    it('keeps the survivor’s own explicit Muscles', async () => {
        const survivor = await insertExercise('ex-keep', 'Squat')
        await db.runAsync(`UPDATE exercises SET muscle_group = 'legs', primary_muscle = 'quads' WHERE id = ?`, survivor)
        const dup = await insertExercise('ex-dup', 'Squat')
        await db.runAsync(`UPDATE exercises SET primary_muscle = 'glutes' WHERE id = ?`, dup)

        await mergeDuplicateExercises({ survivorId: survivor, duplicateIds: [dup] })

        const row = await db.getFirstAsync<{ primary_muscle: string }>(
            'SELECT primary_muscle FROM exercises WHERE id = ?',
            survivor
        )
        expect(row?.primary_muscle).toBe('quads')
    })
})

describe('mergeDuplicateExercises — Workout Template membership', () => {
    const insertTemplate = async (uuid: string, exerciseUuids: string[], userId: string | null = 'user-A') => {
        await db.runAsync(
            `INSERT INTO workout_templates (uuid, user_id, name, exercise_uuids, sync_status, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'synced', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
            uuid,
            userId,
            uuid,
            JSON.stringify(exerciseUuids)
        )
    }

    const templateRow = (uuid: string) =>
        db.getFirstAsync<{ exercise_uuids: string; sync_status: string }>(
            'SELECT exercise_uuids, sync_status FROM workout_templates WHERE uuid = ?',
            uuid
        )

    it('re-points a duplicate onto the survivor, collapsing the resulting repeat', async () => {
        const survivor = await insertExercise('ex-keep', 'Bench Press')
        const dup = await insertExercise('ex-dup', 'Bench Press')
        await insertExercise('ex-squat', 'Squat')
        await insertTemplate('t-push', ['ex-dup', 'ex-squat', 'ex-keep'])
        await insertTemplate('t-legs', ['ex-squat'])

        const result = await mergeDuplicateExercises({ survivorId: survivor, duplicateIds: [dup] })

        expect(result.templatesRepointed).toBe(1)
        const push = await templateRow('t-push')
        expect(JSON.parse(push?.exercise_uuids ?? '[]')).toEqual(['ex-keep', 'ex-squat'])
        expect(push?.sync_status).toBe('dirty')
        // Templates that never referenced the duplicate are not rewritten.
        expect((await templateRow('t-legs'))?.sync_status).toBe('synced')
    })

    it('leaves another principal’s Template alone', async () => {
        const survivor = await insertExercise('ex-keep', 'Bench Press')
        const dup = await insertExercise('ex-dup', 'Bench Press')
        await insertTemplate('t-foreign', ['ex-dup'], 'user-B')

        const result = await mergeDuplicateExercises({ survivorId: survivor, duplicateIds: [dup] })

        expect(result.templatesRepointed).toBe(0)
        expect(JSON.parse((await templateRow('t-foreign'))?.exercise_uuids ?? '[]')).toEqual(['ex-dup'])
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
