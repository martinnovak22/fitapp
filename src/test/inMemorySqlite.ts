import Database from 'better-sqlite3'

export type InMemorySqliteDb = {
    execAsync: (sql: string) => Promise<void>
    getAllAsync: <T = unknown>(sql: string, ...params: unknown[]) => Promise<T[]>
    getFirstAsync: <T = unknown>(sql: string, ...params: unknown[]) => Promise<T | null>
    runAsync: (
        sql: string,
        ...params: unknown[]
    ) => Promise<{ lastInsertRowId: number; changes: number }>
    withTransactionAsync: (fn: () => Promise<void>) => Promise<void>
    closeAsync: () => Promise<void>
}

const normalizeParams = (params: unknown[]): unknown[] => {
    if (params.length === 1 && Array.isArray(params[0])) return params[0] as unknown[]
    return params.map((value) => (value === undefined ? null : value))
}

export const createInMemorySqliteDb = (): InMemorySqliteDb => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')

    return {
        execAsync: async (sql) => {
            db.exec(sql)
        },
        getAllAsync: async (sql, ...params) => {
            return db.prepare(sql).all(...normalizeParams(params)) as never
        },
        getFirstAsync: async (sql, ...params) => {
            const row = db.prepare(sql).get(...normalizeParams(params))
            return (row ?? null) as never
        },
        runAsync: async (sql, ...params) => {
            const result = db.prepare(sql).run(...normalizeParams(params))
            return {
                lastInsertRowId: Number(result.lastInsertRowid),
                changes: result.changes,
            }
        },
        withTransactionAsync: async (fn) => {
            db.exec('BEGIN')
            try {
                await fn()
                db.exec('COMMIT')
            } catch (error) {
                db.exec('ROLLBACK')
                throw error
            }
        },
        closeAsync: async () => {
            db.close()
        },
    }
}
