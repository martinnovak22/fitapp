import * as SQLite from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { DATABASE_NAME, migrateDbIfNeeded } from './schema';

export function useDatabaseInit() {
    const [dbLoaded, setDbLoaded] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        async function init() {
            try {
                const db = await getDb();
                await migrateDbIfNeeded(db);
                setDbLoaded(true);
            } catch (e) {
                setError(e as Error);
                console.error("Database initialization failed:", e);
            }
        }

        init();
    }, []);

    return { dbLoaded, error };
}

let _db: SQLite.SQLiteDatabase | null = null;

export const getDb = async () => {
    if (!_db) {
        _db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    }
    return _db;
};
