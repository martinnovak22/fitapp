// Asserts that ExerciseRepository.create() computes the next position within
// the active principal's scope only — rows belonging to other accounts, guest
// rows, and soft-deleted rows must not inflate it.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb, getTestDb, resetTestDb, type TestDb, useTestDb } from '@/src/test/setupTestDb'

vi.mock('@/src/db/client', () => ({
    getDb: async () => getTestDb(),
}))

const { ExerciseRepository } = await import('../exercises')
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
