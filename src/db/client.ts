import * as SQLite from 'expo-sqlite'
import { useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { DATABASE_NAME, initializeDb } from './schema'

// expo-sqlite caches a single native connection behind this handle. On Android
// the OS can destroy and recreate the activity (memory pressure, or the
// "Don't keep activities" developer setting) while the JS runtime — and this
// cached reference — survives. The native connection is gone, but the stale JS
// handle is not, so the next query rejects with
// "Call to function 'NativeDatabase.prepareAsync' has been rejected". That is
// what surfaces the sync-failed banner on app resume.
//
// Two layers of defence, both contained here so call sites stay unaware:
//   1. Drop the handle when the app backgrounds (Android), so the first access
//      after resume reopens a fresh connection.
//   2. Self-heal any individual call that still hits a dead handle by reopening
//      and retrying once — covers a missed background event or a handle that
//      dies mid-session.

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
    'withTransactionAsync',
    'withExclusiveTransactionAsync',
    'isInTransactionAsync',
])

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
// and we must leave it alone. Called with no argument for the app-background
// reset, which always sheds the current handle.
const resetDbConnection = async (failed?: SQLite.SQLiteDatabase | null): Promise<void> => {
    if (failed && _db !== failed) return
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

const healingHandler: ProxyHandler<SQLite.SQLiteDatabase> = {
    get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver)
        if (typeof value !== 'function') return value
        if (!HEALING_METHODS.has(prop)) return value.bind(target)
        return async (...args: unknown[]) => {
            try {
                return await value.apply(target, args)
            } catch (error) {
                if (!isStaleHandleError(error)) throw error
                await resetDbConnection(target)
                const fresh = await openConnection()
                const method = fresh[prop as keyof SQLite.SQLiteDatabase] as (...a: unknown[]) => unknown
                return await method.apply(fresh, args)
            }
        }
    },
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
    const db = await openConnection()
    return new Proxy(db, healingHandler)
}

// On Android, shed the connection when the app leaves the foreground; the OS may
// invalidate it anyway, and reopening on resume is cheap. iOS keeps the handle
// across background, so resetting there would only risk a redundant reopen.
if (Platform.OS === 'android') {
    AppState.addEventListener('change', (state) => {
        if (state === 'background') {
            void resetDbConnection()
        }
    })
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
