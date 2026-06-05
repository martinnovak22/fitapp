import type { SetData } from './workouts'

// Pure helpers for the addSet write path. Kept dependency-free so the
// position/coalescing rules are tested without the SQLite / react-native chain.

// Sets are positioned by appending after the current last set, or at 0 when the
// workout has none yet.
export const resolveNextSetPosition = (lastSet: { position: number } | null | undefined): number =>
    lastSet ? lastSet.position + 1 : 0

export interface SetMetricColumns {
    weight: number | null
    reps: number | null
    distance: number | null
    duration: number | null
    sub_sets: string | null
}

// Optional metric fields coalesce to null for the INSERT; an explicit 0 is a
// real value and must survive.
export const buildSetMetricColumns = (data: SetData): SetMetricColumns => ({
    weight: data.weight ?? null,
    reps: data.reps ?? null,
    distance: data.distance ?? null,
    duration: data.duration ?? null,
    sub_sets: data.sub_sets ?? null,
})
