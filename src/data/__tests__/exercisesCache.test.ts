import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePrincipal } from '@/src/data/principal'
import { createTestDb, getTestDb, resetTestDb, type TestDb, useTestDb } from '@/src/test/setupTestDb'

vi.mock('@/src/db/client', () => ({
    getDb: async () => getTestDb(),
}))

const { ExerciseRepository } = await import('@/src/db/exercises')
const {
    loadExercisesCached,
    invalidateExercisesCache,
    getCachedExercises,
    createCachedExerciseRepository,
    __resetExercisesCacheForTests,
} = await import('@/src/data/exercisesCache')

let db: TestDb

const seedExercise = async (name: string, position = 0, userId: string | null = 'user-1'): Promise<number> => {
    const result = await db.runAsync(
        `INSERT INTO exercises (uuid, user_id, name, type, position, sync_status, created_at, updated_at)
         VALUES (?, ?, ?, 'weight', ?, 'synced', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
        `ex-${name}`,
        userId,
        name,
        position
    )
    return result.lastInsertRowId
}

beforeEach(async () => {
    await resetTestDb()
    db = await createTestDb()
    useTestDb(db)
    __resetExercisesCacheForTests()
    setActivePrincipal({ mode: 'account', userId: 'user-1' })
})

describe('exercisesCache', () => {
    // getCachedExercises is the synchronous read that useExercises uses to seed
    // its initial state on mount. If it returns a non-null value (even an empty
    // array) the screen skips the skeleton — a guest with zero exercises must
    // not trigger a skeleton flash on every tab switch.
    it('returns an empty array (not null) after a load with no rows', async () => {
        // guest principal — no rows exist in the DB
        setActivePrincipal({ mode: 'guest', userId: null })
        await loadExercisesCached()
        const hit = getCachedExercises()
        expect(hit).not.toBeNull()
        expect(hit).toEqual([])
    })

    it('serves the second read from cache without re-running getAll', async () => {
        await seedExercise('Bench')
        const spy = vi.spyOn(ExerciseRepository, 'getAll')

        const first = await loadExercisesCached()
        const second = await loadExercisesCached()

        expect(first).toEqual(second)
        expect(spy).toHaveBeenCalledTimes(1)
        spy.mockRestore()
    })

    it('coalesces concurrent loads into a single getAll call', async () => {
        await seedExercise('Bench')
        const spy = vi.spyOn(ExerciseRepository, 'getAll')

        const [a, b, c] = await Promise.all([loadExercisesCached(), loadExercisesCached(), loadExercisesCached()])

        expect(a).toEqual(b)
        expect(b).toEqual(c)
        expect(spy).toHaveBeenCalledTimes(1)
        spy.mockRestore()
    })

    it('returns stale-marked cache after explicit invalidation', async () => {
        await seedExercise('Bench')
        await loadExercisesCached()
        invalidateExercisesCache()
        expect(getCachedExercises()).toBeNull()
    })

    it('invalidates the cache when principal changes', async () => {
        await seedExercise('Bench', 0, 'user-1')
        await loadExercisesCached()
        expect(getCachedExercises()).not.toBeNull()

        setActivePrincipal({ mode: 'account', userId: 'user-2' })
        expect(getCachedExercises()).toBeNull()
    })

    it('treats the cache as a miss when the principal key changes even without a notification', async () => {
        await seedExercise('Bench', 0, 'user-1')
        await loadExercisesCached()

        // Simulate the cache surviving across a transition where the listener
        // didn't fire (defense in depth). The principal key on the entry must
        // still gate the hit.
        setActivePrincipal({ mode: 'guest', userId: null })
        expect(getCachedExercises()).toBeNull()
    })

    describe('cached repository wrapper', () => {
        it('invalidates the cache after create', async () => {
            await seedExercise('Bench')
            const wrapped = createCachedExerciseRepository(ExerciseRepository)
            await wrapped.getAll()
            expect(getCachedExercises()).not.toBeNull()

            await wrapped.create('Squat', 'weight')

            expect(getCachedExercises()).toBeNull()
        })

        it('invalidates the cache after update', async () => {
            const id = await seedExercise('Bench')
            const wrapped = createCachedExerciseRepository(ExerciseRepository)
            await wrapped.getAll()

            await wrapped.update(id, { name: 'Bench Press' })

            expect(getCachedExercises()).toBeNull()
            const fresh = await wrapped.getAll()
            expect(fresh.find((row) => row.id === id)?.name).toBe('Bench Press')
        })

        it('invalidates the cache after updatePositions', async () => {
            const a = await seedExercise('Bench', 0)
            const b = await seedExercise('Squat', 1)
            const wrapped = createCachedExerciseRepository(ExerciseRepository)
            await wrapped.getAll()

            await wrapped.updatePositions([
                { id: a, position: 1 },
                { id: b, position: 0 },
            ])

            expect(getCachedExercises()).toBeNull()
        })

        it('invalidates the cache after delete', async () => {
            const id = await seedExercise('Bench')
            const wrapped = createCachedExerciseRepository(ExerciseRepository)
            await wrapped.getAll()

            await wrapped.delete(id)

            expect(getCachedExercises()).toBeNull()
        })

        it('does not let a failing mutation leave a stale cache in place', async () => {
            await seedExercise('Bench')
            const wrapped = createCachedExerciseRepository(ExerciseRepository)
            await wrapped.getAll()

            await expect(wrapped.update(999_999, { name: 'Ghost' })).resolves.toBeUndefined()
            // Even if the row didn't exist, we conservatively invalidate so
            // subsequent reads pay the cheap re-fetch cost rather than risk
            // serving stale rows after a partially-successful write.
            expect(getCachedExercises()).toBeNull()
        })
    })
})
