// Pure reconciliation seam shared by the per-entity pulls. The pull arrows keep
// their SQL; the conflict decision and the remote-row → column-value fan-out
// live here so they are tested directly and the arrows stay thin. The module is
// intentionally dependency-free (no DB layer) so it runs under the node test
// environment without the expo-sqlite / react-native chain.

export const parseIsoMillis = (value: string | null | undefined): number => {
    if (!value) return 0
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
}

export const toIsoOrNow = (value?: string | null): string => value ?? new Date().toISOString()

export interface LocalSyncRow {
    updated_at: string | null
    sync_status: string | null | undefined
}

// Last-writer-wins: keep the local copy when it is unsynced (dirty/failed) and
// strictly newer than the incoming remote row. Otherwise the remote row applies.
export const shouldSkipRemoteRow = (
    local: LocalSyncRow | null | undefined,
    remoteUpdatedAt: string | null | undefined
): boolean => {
    if (!local) return false
    const localIsDirty = local.sync_status === 'dirty' || local.sync_status === 'failed'
    return localIsDirty && parseIsoMillis(local.updated_at) > parseIsoMillis(remoteUpdatedAt)
}

interface ExerciseRowSource {
    name?: string
    type?: string
    muscle_group?: string | null
    photo_key?: string | null
    position?: number
    created_at: string | null
    updated_at: string | null
}

// photo_uri is deliberately absent: it is device-local state. The pull decides
// separately whether the local file survives (see resolvePulledPhotoUri).
export interface ExerciseColumns {
    user_id: string
    name: string | null
    type: string
    muscle_group: string | null
    photo_key: string | null
    position: number
    created_at: string
    updated_at: string
}

export const toExerciseColumns = (row: ExerciseRowSource, userId: string): ExerciseColumns => ({
    user_id: userId,
    name: row.name ?? null,
    type: row.type ?? 'weight',
    muscle_group: row.muscle_group ?? null,
    photo_key: row.photo_key ?? null,
    position: row.position ?? 0,
    created_at: toIsoOrNow(row.created_at),
    updated_at: toIsoOrNow(row.updated_at),
})

interface WorkoutRowSource {
    date?: string
    start_time?: string | null
    end_time?: string | null
    status?: 'in_progress' | 'finished'
    note?: string | null
    created_at: string | null
    updated_at: string | null
}

export interface WorkoutColumns {
    user_id: string
    date: string | null
    start_time: string | null
    end_time: string | null
    status: 'in_progress' | 'finished'
    note: string | null
    created_at: string
    updated_at: string
}

export const toWorkoutColumns = (row: WorkoutRowSource, userId: string): WorkoutColumns => ({
    user_id: userId,
    date: row.date ?? null,
    start_time: row.start_time ?? null,
    end_time: row.end_time ?? null,
    status: row.status ?? 'finished',
    note: row.note ?? null,
    created_at: toIsoOrNow(row.created_at),
    updated_at: toIsoOrNow(row.updated_at),
})

interface SetRowSource {
    weight: number | null
    reps: number | null
    distance: number | null
    duration: number | null
    rpe: number | null
    position: number
    sub_sets: string | null
    created_at: string | null
    updated_at: string | null
}

export interface SetColumns {
    user_id: string
    workout_id: number
    exercise_id: number
    weight: number | null
    reps: number | null
    distance: number | null
    duration: number | null
    rpe: number | null
    position: number
    sub_sets: string | null
    created_at: string
    updated_at: string
}

export const toSetColumns = (row: SetRowSource, userId: string, workoutId: number, exerciseId: number): SetColumns => ({
    user_id: userId,
    workout_id: workoutId,
    exercise_id: exerciseId,
    weight: row.weight,
    reps: row.reps,
    distance: row.distance,
    duration: row.duration,
    rpe: row.rpe,
    position: row.position,
    sub_sets: row.sub_sets,
    created_at: toIsoOrNow(row.created_at),
    updated_at: toIsoOrNow(row.updated_at),
})
