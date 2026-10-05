// Asserts that ExerciseRepository.create() computes the next position within
// the active principal's scope only — rows belonging to other accounts, guest
// rows, and soft-deleted rows must not inflate it.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb, getTestDb, resetTestDb, type TestDb, useTestDb } from '@/src/test/setupTestDb'

vi.mock('@/src/db/client', () => ({
    getDb: async () => getTestDb(),
}))

const { ExerciseRepository } = await import('../exercises')
const { WorkoutRepository } = await import('../workouts')
const { setActivePrincipal } = await import('@/src/data/principal')

let db: TestDb

beforeEach(async () => {
    await resetTestDb()
    db = await createTestDb()
    useTestDb(db)
    setActivePrincipal({ mode: 'account', userId: 'user-A' })
})

const insertExercise = async (
    uuid: string,
    userId: string | null,
    position: number,
    deletedAt: string | null = null
) => {
    await db.runAsync(
        `INSERT INTO exercises (uuid, user_id, name, type, position, sync_status, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, 'weight', ?, 'synced', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ?)`,
        uuid,
        userId,
        uuid,
        position,
        deletedAt
    )
}

const positionOf = async (id: number) => {
    const row = await db.getFirstAsync<{ position: number }>(`SELECT position FROM exercises WHERE id = ?`, id)
    return row?.position
}

describe('ExerciseRepository.create position assignment', () => {
    it('ignores other principals when computing the next position', async () => {
        // Another account and a guest both own higher positions.
        await insertExercise('ex-b1', 'user-B', 7)
        await insertExercise('ex-b2', 'user-B', 8)
        await insertExercise('ex-guest', null, 9)
        // The active account tops out at position 1.
        await insertExercise('ex-a1', 'user-A', 0)
        await insertExercise('ex-a2', 'user-A', 1)

        const id = await ExerciseRepository.create('Bench', 'weight')

        expect(await positionOf(id)).toBe(2)
    })

    it('starts at 0 when the active principal has no exercises, even with foreign rows present', async () => {
        await insertExercise('ex-b1', 'user-B', 5)
        await insertExercise('ex-guest', null, 3)

        const id = await ExerciseRepository.create('Squat', 'weight')

        expect(await positionOf(id)).toBe(0)
    })

    it('ignores soft-deleted rows of the active principal', async () => {
        await insertExercise('ex-a-live', 'user-A', 2)
        await insertExercise('ex-a-deleted', 'user-A', 9, '2026-01-02T00:00:00Z')

        const id = await ExerciseRepository.create('Deadlift', 'weight')

        expect(await positionOf(id)).toBe(3)
    })

    it('scopes a guest principal to user_id IS NULL rows', async () => {
        setActivePrincipal({ mode: 'guest', userId: null })
        await insertExercise('ex-b1', 'user-B', 6)
        await insertExercise('ex-guest', null, 1)

        const id = await ExerciseRepository.create('Row', 'weight')

        expect(await positionOf(id)).toBe(2)
        const row = await db.getFirstAsync<{ user_id: string | null }>(`SELECT user_id FROM exercises WHERE id = ?`, id)
        expect(row?.user_id).toBeNull()
    })
})

const rowById = (id: number) =>
    db.getFirstAsync<{ uuid: string; photo_uri: string | null; photo_key: string | null; sync_status: string }>(
        'SELECT uuid, photo_uri, photo_key, sync_status FROM exercises WHERE id = ?',
        id
    )

describe('ExerciseRepository photo_key', () => {
    it('derives photo_key from the uuid and photo file name on create', async () => {
        const id = await ExerciseRepository.create('Bench', 'weight', { photoUri: 'file:///doc/exercises/171.jpg' })
        const row = await rowById(id)
        expect(row?.photo_key).toBe(`${row?.uuid}-171.jpg`)
    })

    it('leaves photo_key null on create without a photo', async () => {
        const id = await ExerciseRepository.create('Bench', 'weight')
        expect((await rowById(id))?.photo_key).toBeNull()
    })

    it('keeps photo_key when an update passes the unchanged photo uri', async () => {
        const id = await ExerciseRepository.create('Bench', 'weight', { photoUri: 'file:///doc/exercises/171.jpg' })
        const before = await rowById(id)
        await ExerciseRepository.update(id, { name: 'Bench Press', photoUri: 'file:///doc/exercises/171.jpg' })
        expect((await rowById(id))?.photo_key).toBe(before?.photo_key)
    })

    it('regenerates photo_key when the photo is replaced', async () => {
        const id = await ExerciseRepository.create('Bench', 'weight', { photoUri: 'file:///doc/exercises/171.jpg' })
        await ExerciseRepository.update(id, { photoUri: 'file:///doc/exercises/172.jpg' })
        const row = await rowById(id)
        expect(row?.photo_key).toBe(`${row?.uuid}-172.jpg`)
        expect(row?.sync_status).toBe('dirty')
    })

    it('clears photo_key when the photo is removed', async () => {
        const id = await ExerciseRepository.create('Bench', 'weight', { photoUri: 'file:///doc/exercises/171.jpg' })
        await ExerciseRepository.update(id, { photoUri: null })
        const row = await rowById(id)
        expect(row?.photo_key).toBeNull()
        expect(row?.photo_uri).toBeNull()
    })
})

describe('ExerciseRepository taxonomy fields (ADR-0007)', () => {
    const raw = (id: number) =>
        db.getFirstAsync<{
            muscle_group: string | null
            primary_muscle: string | null
            secondary_muscles: string | null
            equipment: string | null
        }>('SELECT muscle_group, primary_muscle, secondary_muscles, equipment FROM exercises WHERE id = ?', id)

    it('stores Muscles and Equipment and mirrors the group into muscle_group for older clients', async () => {
        const id = await ExerciseRepository.create('Bench', 'weight', {
            muscles: { primary: 'chest', secondary: ['triceps', 'chest', 'front_delts'] },
            equipment: 'barbell',
        })

        expect(await raw(id)).toEqual({
            muscle_group: 'chest',
            primary_muscle: 'chest',
            secondary_muscles: '["triceps","front_delts"]',
            equipment: 'barbell',
        })
    })

    it('mirrors a specific Muscle as its group', async () => {
        const id = await ExerciseRepository.create('Pushdown', 'weight', {
            muscles: { primary: 'triceps', secondary: [] },
        })
        expect((await raw(id))?.muscle_group).toBe('arms')
    })

    it('keeps unrecognized legacy text when no primary Muscle is given', async () => {
        const id = await ExerciseRepository.create('Mystery', 'weight', {
            muscles: { primary: null, secondary: [], legacyText: ' Krk ' },
        })
        expect(await raw(id)).toMatchObject({ muscle_group: 'krk', primary_muscle: null, secondary_muscles: '[]' })
    })

    it('rewrites primary, secondary and the mirror together on update, leaving Equipment alone', async () => {
        const id = await ExerciseRepository.create('Bench', 'weight', {
            muscles: { primary: 'chest', secondary: ['triceps'] },
            equipment: 'barbell',
        })

        await ExerciseRepository.update(id, { muscles: { primary: 'quads', secondary: ['glutes'] } })

        expect(await raw(id)).toEqual({
            muscle_group: 'legs',
            primary_muscle: 'quads',
            secondary_muscles: '["glutes"]',
            equipment: 'barbell',
        })
    })

    it('clears Equipment explicitly', async () => {
        const id = await ExerciseRepository.create('Bench', 'weight', {
            muscles: { primary: 'chest', secondary: [] },
            equipment: 'barbell',
        })
        await ExerciseRepository.update(id, { equipment: null })
        expect((await raw(id))?.equipment).toBeNull()
    })
})

describe('ExerciseRepository.delete keeps history (issue #85)', () => {
    // A Workout with one Set of `exerciseId`, owned by the active account.
    const logSet = async (exerciseId: number) => {
        const workoutId = await WorkoutRepository.create('2026-09-01')
        await WorkoutRepository.addSet(workoutId, exerciseId, { weight: 100, reps: 5 })
        return workoutId
    }

    const exerciseRow = (id: number) =>
        db.getFirstAsync<{
            deleted_at: string | null
            updated_at: string
            photo_uri: string | null
            photo_key: string | null
            sync_status: string
        }>('SELECT deleted_at, updated_at, photo_uri, photo_key, sync_status FROM exercises WHERE id = ?', id)

    it('soft-deletes the Exercise and records a tombstone with the same timestamp', async () => {
        const id = await ExerciseRepository.create('Bench', 'weight')
        const uuid = (await rowById(id))?.uuid

        await ExerciseRepository.delete(id)

        const row = await exerciseRow(id)
        expect(row?.deleted_at).toEqual(expect.any(String))
        expect(row?.updated_at).toBe(row?.deleted_at)
        const tombstone = await db.getFirstAsync<{ entity_uuid: string; deleted_at: string; sync_status: string }>(
            `SELECT entity_uuid, deleted_at, sync_status FROM deletion_tombstones WHERE entity_type = 'exercise'`
        )
        expect(tombstone).toEqual({ entity_uuid: uuid, deleted_at: row?.deleted_at, sync_status: 'dirty' })
    })

    it('keeps every Set of the Exercise, still listed by getSets with the Exercise name', async () => {
        const id = await ExerciseRepository.create('Bench', 'weight')
        const workoutId = await logSet(id)

        await ExerciseRepository.delete(id)

        const sets = await WorkoutRepository.getSets(workoutId)
        expect(sets).toHaveLength(1)
        expect(sets[0]).toMatchObject({ exercise_id: id, exercise_name: 'Bench', weight: 100, reps: 5 })
    })

    it('hides the deleted Exercise from getAll and getById', async () => {
        const id = await ExerciseRepository.create('Bench', 'weight')
        const kept = await ExerciseRepository.create('Squat', 'weight')

        await ExerciseRepository.delete(id)

        expect((await ExerciseRepository.getAll()).map((e) => e.id)).toEqual([kept])
        expect(await ExerciseRepository.getById(id)).toBeNull()
    })

    it('still offers the deleted Exercise for editing the Workout’s existing Sets', async () => {
        const id = await ExerciseRepository.create('Bench', 'weight')
        const workoutId = await logSet(id)

        await ExerciseRepository.delete(id)

        const setExercises = await WorkoutRepository.getSetExercises(workoutId)
        expect(setExercises.map((e) => ({ id: e.id, name: e.name, deleted: !!e.deleted_at }))).toEqual([
            { id, name: 'Bench', deleted: true },
        ])
    })

    it('ignores edits and reorders that target the deleted Exercise', async () => {
        const id = await ExerciseRepository.create('Bench', 'weight')
        await ExerciseRepository.delete(id)
        const before = await exerciseRow(id)

        await ExerciseRepository.update(id, { name: 'Stale edit' })
        await ExerciseRepository.updatePositions([{ id, position: 5 }])

        expect(await exerciseRow(id)).toEqual(before)
        expect((await db.getFirstAsync<{ name: string }>('SELECT name FROM exercises WHERE id = ?', id))?.name).toBe(
            'Bench'
        )
    })

    it('rejects new Sets for the deleted Exercise', async () => {
        const id = await ExerciseRepository.create('Bench', 'weight')
        const workoutId = await WorkoutRepository.create('2026-09-02')

        await ExerciseRepository.delete(id)

        await expect(WorkoutRepository.addSet(workoutId, id, { reps: 5 })).rejects.toThrow()
    })

    it('drops the photo reference, since the photo file goes with the Exercise', async () => {
        const id = await ExerciseRepository.create('Bench', 'weight', { photoUri: 'file:///doc/exercises/171.jpg' })

        await ExerciseRepository.delete(id)

        expect(await exerciseRow(id)).toMatchObject({ photo_uri: null, photo_key: null })
    })

    it('leaves the sync status alone, so only the tombstone pushes a synced Exercise', async () => {
        await insertExercise('ex-synced', 'user-A', 0)
        const row = await db.getFirstAsync<{ id: number }>(`SELECT id FROM exercises WHERE uuid = 'ex-synced'`)

        await ExerciseRepository.delete(row?.id as number)

        expect((await exerciseRow(row?.id as number))?.sync_status).toBe('synced')
    })

    it('is a no-op for another principal’s Exercise and for one already deleted', async () => {
        await insertExercise('ex-b', 'user-B', 0)
        await insertExercise('ex-gone', 'user-A', 1, '2026-01-02T00:00:00Z')
        const ids = await db.getAllAsync<{ id: number }>(`SELECT id FROM exercises ORDER BY id`)

        for (const { id } of ids) await ExerciseRepository.delete(id)

        expect((await exerciseRow(ids[0].id))?.deleted_at).toBeNull()
        expect((await exerciseRow(ids[1].id))?.deleted_at).toBe('2026-01-02T00:00:00Z')
        const tombstones = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) c FROM deletion_tombstones')
        expect(tombstones?.c).toBe(0)
    })
})
