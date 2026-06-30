import type { Exercise } from '@/src/db/exercises'

export type DuplicateGroup = {
    normalizedName: string
    members: Exercise[]
    survivor: Exercise
    duplicates: Exercise[]
}

// Normalize an Exercise name into its match key: trim, collapse internal
// whitespace, lowercase, and fold diacritics so Czech names with and without
// accents match. Affects matching only — never the stored name.
export const normalizeExerciseName = (name: string): string =>
    name
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()

// Deterministic survivor pre-selection (ADR-0005), in priority order:
// oldest created_at → most referencing Sets → synced over unsynced → lowest
// uuid. Returns negative when `a` should win over `b`.
const survivorRank = (a: Exercise, b: Exercise, setCounts: ReadonlyMap<number, number>): number => {
    const byCreatedAt = (a.created_at ?? '').localeCompare(b.created_at ?? '')
    if (byCreatedAt !== 0) return byCreatedAt

    const bySetCount = (setCounts.get(b.id) ?? 0) - (setCounts.get(a.id) ?? 0)
    if (bySetCount !== 0) return bySetCount

    const bySynced = Number(b.sync_status === 'synced') - Number(a.sync_status === 'synced')
    if (bySynced !== 0) return bySynced

    return (a.uuid ?? '').localeCompare(b.uuid ?? '')
}

const selectSurvivor = (members: Exercise[], setCounts: ReadonlyMap<number, number>): Exercise =>
    members.reduce((best, candidate) => (survivorRank(candidate, best, setCounts) < 0 ? candidate : best))

export const findDuplicateExerciseGroups = (
    exercises: Exercise[],
    setCounts: ReadonlyMap<number, number>
): DuplicateGroup[] => {
    const byName = new Map<string, Exercise[]>()
    for (const exercise of exercises) {
        if (exercise.deleted_at) continue
        const key = normalizeExerciseName(exercise.name)
        const bucket = byName.get(key)
        if (bucket) bucket.push(exercise)
        else byName.set(key, [exercise])
    }

    const groups: DuplicateGroup[] = []
    for (const [normalizedName, members] of byName) {
        if (members.length < 2) continue
        const survivor = selectSurvivor(members, setCounts)
        groups.push({
            normalizedName,
            members,
            survivor,
            duplicates: members.filter((m) => m !== survivor),
        })
    }
    return groups
}
