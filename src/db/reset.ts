import { getDb } from './client'

export const hasLocalUserData = async (): Promise<boolean> => {
    const db = await getDb()
    const counts = await Promise.all(
        ['exercises', 'workouts', 'sets', 'workout_templates'].map((table) =>
            db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`)
        )
    )

    return counts.some((row) => (row?.count ?? 0) > 0)
}
