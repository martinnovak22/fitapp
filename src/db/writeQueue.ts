import * as SQLite from 'expo-sqlite'
import { getDb } from './client'

const SQLITE_BUSY_RETRY_COUNT = 4
const SQLITE_BUSY_RETRY_DELAY_MS = 80

let writeQueue: Promise<void> = Promise.resolve()

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isSqliteBusyError = (error: unknown) => {
    if (!(error instanceof Error)) return false
    const message = error.message.toLowerCase()
    return message.includes('database is locked') || message.includes('sqlite_busy')
}

const enqueueWrite = async <T>(task: () => Promise<T>): Promise<T> => {
    const run = writeQueue.then(task, task)
    writeQueue = run.then(
        () => undefined,
        () => undefined
    )
    return run
}

export const executeWrite = async <T>(operation: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> => {
    return enqueueWrite(async () => {
        const db = await getDb()
        let attempt = 0

        while (true) {
            try {
                return await operation(db)
            } catch (error) {
                if (!isSqliteBusyError(error) || attempt >= SQLITE_BUSY_RETRY_COUNT) throw error
                attempt += 1
                await sleep(SQLITE_BUSY_RETRY_DELAY_MS * attempt)
            }
        }
    })
}

export const executeWriteTransaction = async <T>(operation: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> => {
    return executeWrite(async (db) => {
        let result!: T
        await db.withTransactionAsync(async () => {
            result = await operation(db)
        })
        return result
    })
}
