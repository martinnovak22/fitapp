// Serialization of a Workout Template's membership: the uuids of the Exercises
// it contains (ADR-0006). Stored as a JSON array in workout_templates.exercise_uuids.
// Dependency-free so the sync pull/push paths and node tests can share it.

// Trims, drops blanks and de-duplicates while keeping first-seen order, so the
// stored array is canonical no matter how the caller assembled it.
export const normalizeExerciseUuids = (uuids: readonly unknown[]): string[] => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const value of uuids) {
        if (typeof value !== 'string') continue
        const uuid = value.trim()
        if (!uuid || seen.has(uuid)) continue
        seen.add(uuid)
        out.push(uuid)
    }
    return out
}

// Tolerates every shape the column can arrive in: the local TEXT column (a JSON
// string), the remote jsonb column (an already-parsed array), or junk. Junk
// reads as an empty Template rather than crashing a list render.
export const parseExerciseUuids = (raw: unknown): string[] => {
    if (Array.isArray(raw)) return normalizeExerciseUuids(raw)
    if (typeof raw !== 'string' || raw.length === 0) return []
    try {
        const parsed: unknown = JSON.parse(raw)
        return Array.isArray(parsed) ? normalizeExerciseUuids(parsed) : []
    } catch {
        return []
    }
}

export const serializeExerciseUuids = (uuids: readonly unknown[]): string =>
    JSON.stringify(normalizeExerciseUuids(uuids))

// The members that still resolve to a live Exercise, in the caller's (the
// user's Exercise-list) order. Every reader of a Template goes through this:
// unknown uuids — deleted, or not pulled to this device yet — are skipped, not
// treated as errors (ADR-0006).
export const resolveMembers = <E extends { uuid?: string | null }>(
    memberUuids: Iterable<string>,
    exercises: readonly E[]
): E[] => {
    const members = new Set(memberUuids)
    return exercises.filter((exercise) => !!exercise.uuid && members.has(exercise.uuid))
}

// Replaces every uuid in `from` with `to`, collapsing the duplicates that
// produces. Used when Exercise De-duplication merges Exercises onto a Survivor.
// Returns null when nothing changed so callers can skip the write.
export const repointExerciseUuids = (raw: unknown, from: ReadonlySet<string>, to: string): string | null => {
    const current = parseExerciseUuids(raw)
    if (!current.some((uuid) => from.has(uuid))) return null
    return serializeExerciseUuids(current.map((uuid) => (from.has(uuid) ? to : uuid)))
}
