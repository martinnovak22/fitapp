import * as SQLite from 'expo-sqlite'
import { useEffect, useState } from 'react'
import { DATABASE_NAME, initializeDb } from './schema'

// expo-sqlite caches a single native connection behind this handle. On Android
// the OS can destroy and recreate the activity (memory pressure, or the
// "Don't keep activities" developer setting) while the JS runtime — and this
// cached reference — survives. The native connection is gone, but the stale JS
// handle is not, so the next query rejects with
// "Call to function 'NativeDatabase.prepareAsync' has been rejected". That is
// what surfaces the sync-failed banner on app resume.
//
// The defence is lazy, contained here so call sites stay unaware: any call
// that hits a dead handle reopens a fresh connection and retries once.
//
// Deliberately NO eager reset on AppState 'background': the camera, share
// sheets, and permission dialogs all background the app while sync cycles and
// queued writes are mid-statement on this connection, and closeAsync on a busy
// handle crashes natively on Android. A handle that the OS actually killed is
// indistinguishable from a healthy one until a call fails, and the lazy heal
// covers that case without ever closing a connection that has work in flight.

let _db: SQLite.SQLiteDatabase | null = null
let _opening: Promise<SQLite.SQLiteDatabase> | null = null

const STALE_HANDLE_PATTERN =
    /prepareAsync.*reject|has been rejected|access to closed resource|database is closed|nativedatabase.*reject/i

const isStaleHandleError = (error: unknown): boolean =>
    error instanceof Error && STALE_HANDLE_PATTERN.test(error.message)

// Async methods that touch the native connection and therefore can reject when
// the handle is stale. Non-async members (databasePath, etc.) pass through.
const HEALING_METHODS = new Set<PropertyKey>([
    'execAsync',
    'runAsync',
    'getAllAsync',
    'getFirstAsync',
    'getEachAsync',
    'prepareAsync',
    'isInTransactionAsync',
])

// Transaction wrappers are never heal-retried: by the time the failure
// surfaces, an unknown prefix of the callback may have executed, and re-running
// the whole callback on a fresh connection would double-apply it. They still
// shed the dead handle so the next attempt reopens cleanly.
const TRANSACTION_METHODS = new Set<PropertyKey>(['withTransactionAsync', 'withExclusiveTransactionAsync'])

const openConnection = async (): Promise<SQLite.SQLiteDatabase> => {
    if (_db) return _db
    if (!_opening) {
        _opening = SQLite.openDatabaseAsync(DATABASE_NAME)
            .then((db) => {
                _db = db
                return db
            })
            .finally(() => {
                _opening = null
            })
    }
    return _opening
}

// Drop the cached connection (best-effort close) so the next getDb() reopens.
// Safe to call on a handle that is already dead — closeAsync just rejects and we
// swallow it. Pass the handle that actually failed so concurrent healers don't
// close a connection a sibling already reopened: if the live handle is no longer
// the one that failed, another healer has already swapped in a fresh connection
// and we must leave it alone.
const resetDbConnection = async (failed: SQLite.SQLiteDatabase): Promise<void> => {
    if (_db !== failed) return
    const stale = _db
    _db = null
    _opening = null
    if (stale) {
        try {
            await stale.closeAsync()
        } catch {
            // The native handle is almost certainly already gone; ignore.
        }
    }
}

// One handler per proxy so the in-transaction flag is scoped to the caller
// that opened the transaction: its own statements must not heal individually
// (a lone retry on a fresh connection auto-commits outside the transaction),
// while unrelated readers on other proxies keep healing as usual.
const makeHealingHandler = (): ProxyHandler<SQLite.SQLiteDatabase> => {
    let inTransaction = false
    return {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver)
            if (typeof value !== 'function') return value
            if (TRANSACTION_METHODS.has(prop)) {
                return async (...args: unknown[]) => {
                    inTransaction = true
                    try {
                        return await value.apply(target, args)
                    } catch (error) {
                        if (isStaleHandleError(error)) await resetDbConnection(target)
                        throw error
                    } finally {
                        inTransaction = false
                    }
                }
            }
            if (!HEALING_METHODS.has(prop)) return value.bind(target)
            return async (...args: unknown[]) => {
                try {
                    return await value.apply(target, args)
                } catch (error) {
                    if (!isStaleHandleError(error)) throw error
                    await resetDbConnection(target)
                    if (inTransaction) throw error
                    const fresh = await openConnection()
                    const method = fresh[prop as keyof SQLite.SQLiteDatabase] as (...a: unknown[]) => unknown
                    return await method.apply(fresh, args)
                }
            }
        },
    }
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
    const db = await openConnection()
    return new Proxy(db, makeHealingHandler())
}

export function useDatabaseInit() {
    const [dbLoaded, setDbLoaded] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        async function init() {
            try {
                const db = await getDb()
                await initializeDb(db)
                setDbLoaded(true)
            } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e))
                setError(error)
                console.error('Database initialization failed:', error)
            }
        }

        init()
    }, [])

    return { dbLoaded, error }
}
