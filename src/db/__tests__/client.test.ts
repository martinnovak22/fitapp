import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const STALE_MESSAGE = "Call to function 'NativeDatabase.prepareAsync' has been rejected"

const { openDatabaseAsync } = vi.hoisted(() => ({ openDatabaseAsync: vi.fn() }))

vi.mock('expo-sqlite', () => ({ openDatabaseAsync }))

vi.mock('../schema', () => ({
    DATABASE_NAME: 'test.db',
    initializeDb: vi.fn(async () => {}),
}))

// A fake handle whose getFirstAsync throws a primed error once, then succeeds.
let openCount = 0
let nextError: Error | null = null

const makeFakeDb = () => {
    const id = ++openCount
    const throwPrimedError = () => {
        if (nextError) {
            const error = nextError
            nextError = null
            throw error
        }
    }
    return {
        id,
        getFirstAsync: vi.fn(async () => {
            throwPrimedError()
            return { value: id }
        }),
        runAsync: vi.fn(async () => {
            throwPrimedError()
            return { changes: 1 }
        }),
        withTransactionAsync: vi.fn(async (callback: () => Promise<void>) => {
            throwPrimedError()
            await callback()
        }),
        closeAsync: vi.fn(async () => {}),
    }
}

let getDb: typeof import('../client').getDb

beforeEach(async () => {
    openCount = 0
    nextError = null
    openDatabaseAsync.mockReset()
    openDatabaseAsync.mockImplementation(async () => makeFakeDb())
    // Fresh module per test: resets the cached connection.
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

    it('does not heal-retry a transaction, but sheds the dead handle for the next attempt', async () => {
        const db = await getDb()
        nextError = new Error(STALE_MESSAGE)
        const callback = vi.fn(async () => {})

        // The transaction fails cleanly — re-running the callback on a fresh
        // connection could double-apply a partially executed body.
        await expect(db.withTransactionAsync(callback)).rejects.toThrow(STALE_MESSAGE)
        expect(callback).not.toHaveBeenCalled()
        expect(openDatabaseAsync).toHaveBeenCalledTimes(1)

        // The dead handle was shed, so the next access reopens.
        const retry = await (await getDb()).getFirstAsync<{ value: number }>('SELECT 1')
        expect(openDatabaseAsync).toHaveBeenCalledTimes(2)
        expect(retry).toEqual({ value: 2 })
    })

    it('does not heal a statement inside a transaction onto a fresh connection', async () => {
        const db = await getDb()

        // A lone statement retried on a fresh connection would auto-commit
        // outside the transaction; it must fail the transaction instead.
        await expect(
            db.withTransactionAsync(async () => {
                nextError = new Error(STALE_MESSAGE)
                await db.runAsync('INSERT INTO t VALUES (1)')
            })
        ).rejects.toThrow(STALE_MESSAGE)
        expect(openDatabaseAsync).toHaveBeenCalledTimes(1)

        // Statements outside the transaction heal again as usual.
        nextError = new Error(STALE_MESSAGE)
        const result = await db.getFirstAsync<{ value: number }>('SELECT 1')
        expect(openDatabaseAsync).toHaveBeenCalledTimes(2)
        expect(result).toEqual({ value: 2 })
    })

    it('does not close the fresh connection when a stale handle heals after a prior heal', async () => {
        // Handle 1 is the dropped connection and always rejects. A proxy bound to
        // it keeps being used after a heal already swapped in handle 2 (mirrors an
        // in-flight op that captured the old handle). The second heal must reuse
        // handle 2, not reset and close it out from under everyone else.
        const handles: { id: number; closeAsync: ReturnType<typeof vi.fn> }[] = []
        openDatabaseAsync.mockImplementation(async () => {
            const handle = { id: handles.length + 1 } as (typeof handles)[number] & {
                getFirstAsync: ReturnType<typeof vi.fn>
            }
            handle.closeAsync = vi.fn(async () => {})
            handle.getFirstAsync = vi.fn(async () => {
                if (handle.id === 1) throw new Error(STALE_MESSAGE)
                return { value: handle.id }
            })
            handles.push(handle)
            return handle
        })

        // Proxy stays bound to handle 1 (the dropped connection) across calls.
        const db = await getDb()
        const first = await db.getFirstAsync<{ value: number }>('SELECT 1') // heals 1 -> 2
        const second = await db.getFirstAsync<{ value: number }>('SELECT 1') // stale 1 again

        // Both heal onto handle 2; no third connection, and handle 2 is never closed.
        expect(first).toEqual({ value: 2 })
        expect(second).toEqual({ value: 2 })
        expect(openDatabaseAsync).toHaveBeenCalledTimes(2)
        expect(handles[1].closeAsync).not.toHaveBeenCalled()
    })
})
