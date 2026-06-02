import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const STALE_MESSAGE = "Call to function 'NativeDatabase.prepareAsync' has been rejected"

const { openDatabaseAsync } = vi.hoisted(() => ({ openDatabaseAsync: vi.fn() }))

vi.mock('expo-sqlite', () => ({ openDatabaseAsync }))

let appStateHandler: ((state: string) => void) | undefined

vi.mock('react-native', () => ({
    Platform: { OS: 'android' },
    AppState: {
        addEventListener: (_event: string, handler: (state: string) => void) => {
            appStateHandler = handler
            return { remove: vi.fn() }
        },
    },
}))

vi.mock('../schema', () => ({
    DATABASE_NAME: 'test.db',
    initializeDb: vi.fn(async () => {}),
}))

// A fake handle whose getFirstAsync throws a primed error once, then succeeds.
let openCount = 0
let nextError: Error | null = null

const makeFakeDb = () => {
    const id = ++openCount
    return {
        id,
        getFirstAsync: vi.fn(async () => {
            if (nextError) {
                const error = nextError
                nextError = null
                throw error
            }
            return { value: id }
        }),
        closeAsync: vi.fn(async () => {}),
    }
}

let getDb: typeof import('../client').getDb

beforeEach(async () => {
    openCount = 0
    nextError = null
    appStateHandler = undefined
    openDatabaseAsync.mockReset()
    openDatabaseAsync.mockImplementation(async () => makeFakeDb())
    // Fresh module per test: resets the cached connection and re-registers the
    // AppState listener against this test's handler capture.
    vi.resetModules()
    ;({ getDb } = await import('../client'))
})

afterEach(() => {
    vi.clearAllMocks()
})

describe('getDb connection handling', () => {
    it('caches a single connection across calls', async () => {
        await (await getDb()).getFirstAsync('SELECT 1')
        await (await getDb()).getFirstAsync('SELECT 1')
        expect(openDatabaseAsync).toHaveBeenCalledTimes(1)
    })

    it('self-heals a stale-handle rejection by reopening and retrying once', async () => {
        const db = await getDb()
        nextError = new Error(STALE_MESSAGE)

        const result = await db.getFirstAsync<{ value: number }>('SELECT 1')

        // First handle rejected, a second connection opened, retry succeeded.
        expect(openDatabaseAsync).toHaveBeenCalledTimes(2)
        expect(result).toEqual({ value: 2 })
    })

    it('does not retry errors that are not stale-handle rejections', async () => {
        const db = await getDb()
        nextError = new Error('UNIQUE constraint failed')

        await expect(db.getFirstAsync('SELECT 1')).rejects.toThrow('UNIQUE constraint failed')
        expect(openDatabaseAsync).toHaveBeenCalledTimes(1)
    })

    it('drops the connection on Android background so the next access reopens', async () => {
        await (await getDb()).getFirstAsync('SELECT 1')
        expect(openDatabaseAsync).toHaveBeenCalledTimes(1)

        expect(appStateHandler).toBeDefined()
        appStateHandler!('background')
        await Promise.resolve()
        await Promise.resolve()

        await (await getDb()).getFirstAsync('SELECT 1')
        expect(openDatabaseAsync).toHaveBeenCalledTimes(2)
    })

    it('ignores transient inactive transitions', async () => {
        await (await getDb()).getFirstAsync('SELECT 1')
        appStateHandler!('inactive')
        await Promise.resolve()

        await (await getDb()).getFirstAsync('SELECT 1')
        expect(openDatabaseAsync).toHaveBeenCalledTimes(1)
    })
})
