import type * as SQLite from 'expo-sqlite'
import { initializeDb } from '@/src/db/schema'
import { createInMemorySqliteDb, type InMemorySqliteDb } from './inMemorySqlite'

export type TestDb = InMemorySqliteDb

let currentTestDb: TestDb | null = null

export const createTestDb = async (): Promise<TestDb> => {
    const db = createInMemorySqliteDb()
    await initializeDb(db as unknown as SQLite.SQLiteDatabase)
    return db
}

export const useTestDb = (db: TestDb): void => {
    currentTestDb = db
}

export const getTestDb = (): TestDb => {
    if (!currentTestDb) {
        throw new Error('No test DB registered. Call useTestDb(db) before using getDb().')
    }
    return currentTestDb
}

export const resetTestDb = async () => {
    if (currentTestDb) {
        await currentTestDb.closeAsync()
        currentTestDb = null
    }
}
