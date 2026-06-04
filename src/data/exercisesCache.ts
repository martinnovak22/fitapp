import { getActivePrincipal, onPrincipalChange } from '@/src/data/principal'
import type { ExerciseRepositoryPort } from '@/src/data/repositories'
import type { Exercise, ExerciseType } from '@/src/db/exercises'
import { ExerciseRepository } from '@/src/db/exercises'

// In-memory cache for the exercises list.
//
// Exercises change rarely but are read on every focus of the workout-session
// and exercises screens. This cache lets focus reloads be a no-op when nothing
// has changed, while keeping correctness via explicit invalidation on every
// known write seam: local mutations, sync pulls, and principal transitions.
//
// The cache is keyed by the active principal so guest -> account (or any other)
// transitions are guaranteed misses without needing an external clear step.

type Listener = () => void

type CachedEntry = {
    principalKey: string
    rows: Exercise[]
}

let cached: CachedEntry | null = null
let inFlight: Promise<Exercise[]> | null = null
const listeners = new Set<Listener>()

const principalKey = (): string => {
    const { mode, userId } = getActivePrincipal()
    return `${mode}:${userId ?? ''}`
}

const notify = () => {
    for (const listener of listeners) listener()
}

export const getCachedExercises = (): Exercise[] | null => {
    if (!cached) return null
    if (cached.principalKey !== principalKey()) return null
    return cached.rows
}

export const loadExercisesCached = async (options: { force?: boolean } = {}): Promise<Exercise[]> => {
    const key = principalKey()
    if (!options.force) {
        const hit = getCachedExercises()
        if (hit) return hit
        if (inFlight) return inFlight
    }
    inFlight = (async () => {
        const rows = await ExerciseRepository.getAll()
        cached = { principalKey: key, rows }
        return rows
    })()
    try {
        const rows = await inFlight
        return rows
    } finally {
        inFlight = null
    }
}

export const invalidateExercisesCache = (): void => {
    if (cached === null && inFlight === null) return
    cached = null
    inFlight = null
    notify()
}

// Exposed for tests that want a deterministic starting point.
export const __resetExercisesCacheForTests = (): void => {
    cached = null
    inFlight = null
    listeners.clear()
}

// Principal transitions (guest <-> account, sign-in, sign-out) must invalidate
// the cache because the scoped WHERE clause changes underneath us.
onPrincipalChange(() => {
    invalidateExercisesCache()
})

// Repository port wrapper that serves reads from the cache and invalidates on
// every mutation. Plugged in by `repositories.ts` so every caller (UI, CSV,
// sync push) benefits without having to remember to invalidate.
export const createCachedExerciseRepository = (base: typeof ExerciseRepository): ExerciseRepositoryPort => ({
    getAll: () => loadExercisesCached(),
    getById: (id: number) => base.getById(id),
    create: async (name: string, type: ExerciseType, muscle_group?: string, photo_uri?: string) => {
        try {
            return await base.create(name, type, muscle_group, photo_uri)
        } finally {
            invalidateExercisesCache()
        }
    },
    update: async (id, data) => {
        try {
            await base.update(id, data)
        } finally {
            invalidateExercisesCache()
        }
    },
    updatePositions: async (updates) => {
        try {
            await base.updatePositions(updates)
        } finally {
            invalidateExercisesCache()
        }
    },
    delete: async (id) => {
        try {
            await base.delete(id)
        } finally {
            invalidateExercisesCache()
        }
    },
})
