import type { SetData } from './workouts'

// Pure helpers for the set write paths (addSet / updateSet). Kept
// dependency-free so the position/coalescing rules are tested without the
// SQLite / react-native chain.

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

// Generous sanity cap on the serialized sub_sets JSON. A legitimate set is a
// few hundred bytes; anything near this limit is a bug upstream, and letting it
// through would only fail later at the server's request-size limit and park the
// row as blocked in the push pipeline.
export const MAX_SUB_SETS_LENGTH = 64 * 1024

// Optional metric fields coalesce to null for the INSERT; an explicit 0 is a
// real value and must survive.
export const buildSetMetricColumns = (data: SetData): SetMetricColumns => {
    if (data.sub_sets && data.sub_sets.length > MAX_SUB_SETS_LENGTH) {
        throw new Error(`sub_sets JSON exceeds ${MAX_SUB_SETS_LENGTH} characters (got ${data.sub_sets.length}).`)
    }
    return {
        weight: data.weight ?? null,
        reps: data.reps ?? null,
        distance: data.distance ?? null,
        duration: data.duration ?? null,
        sub_sets: data.sub_sets ?? null,
    }
}
