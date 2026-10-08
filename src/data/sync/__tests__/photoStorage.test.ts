// Photo hydration against a mocked file system and Storage: a photo whose
// object is gone (issue #88) loses its key here; any other failure retries.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb, getTestDb, resetTestDb, type TestDb, useTestDb } from '@/src/test/setupTestDb'

const { downloadAsync, readAsStringAsync } = vi.hoisted(() => ({
    downloadAsync: vi.fn(),
    readAsStringAsync: vi.fn(),
}))

vi.mock('expo-file-system/legacy', () => ({
    documentDirectory: 'file:///doc/',
    downloadAsync,
    readAsStringAsync,
    deleteAsync: vi.fn(async () => {}),
    makeDirectoryAsync: vi.fn(async () => {}),
    getInfoAsync: vi.fn(async () => ({ exists: false })),
}))

vi.mock('@/src/db/client', () => ({
    getDb: async () => getTestDb(),
}))

vi.mock('@/src/data/remote/supabase/config', () => ({
    getSupabaseConfig: () => ({ url: 'https://example.test', publicKey: 'anon' }),
}))

vi.mock('@/src/data/remote/supabase/session', () => ({
    getSupabaseSession: () => ({ accessToken: 'token', userId: 'user-1' }),
    refreshSupabaseAccessToken: async () => null,
}))

const { hydrateExercisePhotos } = await import('../photoStorage')

const userId = 'user-1'
const KEY = 'ex-1-1718097829000.jpg'
const NO_SUCH_KEY = JSON.stringify({
    statusCode: '404',
    error: 'not_found',
    message: 'Object not found',
    code: 'NoSuchKey',
})

let db: TestDb

beforeEach(async () => {
    await resetTestDb()
    db = await createTestDb()
    useTestDb(db)
    downloadAsync.mockReset()
    readAsStringAsync.mockReset()
    await db.runAsync(
        `INSERT INTO exercises (uuid, user_id, name, type, photo_key, sync_status, created_at, updated_at)
         VALUES ('ex-1', ?, 'Bench', 'weight', ?, 'synced', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
        userId,
        KEY
    )
})

const photoRow = () =>
    db.getFirstAsync<{ photo_key: string | null; photo_uri: string | null; sync_status: string }>(
        `SELECT photo_key, photo_uri, sync_status FROM exercises WHERE uuid = 'ex-1'`
    )

describe('hydrateExercisePhotos', () => {
    it('downloads a photo and points the row at the local copy', async () => {
        downloadAsync.mockResolvedValue({ status: 200 })

        expect(await hydrateExercisePhotos(userId)).toBe(1)

        expect(await photoRow()).toEqual({
            photo_key: KEY,
            photo_uri: `file:///doc/exercises/${KEY}`,
            sync_status: 'synced',
        })
    })

    it('clears the key, without dirtying the row, when Storage says the object is gone', async () => {
        downloadAsync.mockResolvedValue({ status: 400 })
        readAsStringAsync.mockResolvedValue(NO_SUCH_KEY)

        expect(await hydrateExercisePhotos(userId)).toBe(0)

        expect(await photoRow()).toEqual({ photo_key: null, photo_uri: null, sync_status: 'synced' })
    })

    it('also clears a dead local file path on the first, full pass of another account', async () => {
        await db.runAsync(
            `INSERT INTO exercises (uuid, user_id, name, type, photo_key, photo_uri, sync_status, created_at, updated_at)
             VALUES ('ex-2', 'user-2', 'Row', 'weight', ?, 'file:///doc/exercises/gone.jpg', 'synced', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
            KEY
        )
        downloadAsync.mockResolvedValue({ status: 400 })
        readAsStringAsync.mockResolvedValue(NO_SUCH_KEY)

        await hydrateExercisePhotos('user-2')

        expect(await db.getFirstAsync(`SELECT photo_key, photo_uri FROM exercises WHERE uuid = 'ex-2'`)).toEqual({
            photo_key: null,
            photo_uri: null,
        })
    })

    it('keeps the key on any other failure, so the next cycle retries', async () => {
        downloadAsync.mockResolvedValueOnce({ status: 400 })
        readAsStringAsync.mockResolvedValueOnce(
            JSON.stringify({ statusCode: '403', error: 'Unauthorized', message: 'jwt expired' })
        )
        downloadAsync.mockResolvedValueOnce({ status: 503 })
        downloadAsync.mockRejectedValueOnce(new Error('offline'))

        await hydrateExercisePhotos(userId)
        await hydrateExercisePhotos(userId)
        await hydrateExercisePhotos(userId)

        expect(await photoRow()).toEqual({ photo_key: KEY, photo_uri: null, sync_status: 'synced' })
    })

    it('leaves a key that changed while the download ran', async () => {
        downloadAsync.mockImplementation(async () => {
            await db.runAsync(`UPDATE exercises SET photo_key = 'ex-1-2.jpg' WHERE uuid = 'ex-1'`)
            return { status: 400 }
        })
        readAsStringAsync.mockResolvedValue(NO_SUCH_KEY)

        await hydrateExercisePhotos(userId)

        expect((await photoRow())?.photo_key).toBe('ex-1-2.jpg')
    })
})
