import { getDb } from './client'

export const hasLocalUserData = async (): Promise<boolean> => {
    const db = await getDb()
    const [exerciseCount, workoutCount, setCount] = await Promise.all([
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercises'),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM workouts'),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sets'),
    ])

    return (exerciseCount?.count ?? 0) > 0 || (workoutCount?.count ?? 0) > 0 || (setCount?.count ?? 0) > 0
}
