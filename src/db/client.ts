import * as SQLite from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { DATABASE_NAME, initializeDb } from './schema';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!_db) {
        _db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    }
    return _db;
}

export function useDatabaseInit() {
    const [dbLoaded, setDbLoaded] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        async function init() {
            try {
                const db = await getDb();
                await initializeDb(db);
                setDbLoaded(true);
            } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e));
                setError(error);
                console.error('Database initialization failed:', error);
            }
        }

        init();
    }, []);

    return { dbLoaded, error };
}
