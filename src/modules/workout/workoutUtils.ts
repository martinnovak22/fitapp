import type { SubSet } from '@/src/db/workouts'

export function parseSubSets(subSetsJson: string | null | undefined): SubSet[] {
    if (!subSetsJson) return []
    try {
        const parsed = JSON.parse(subSetsJson)
        return Array.isArray(parsed) ? (parsed as SubSet[]) : []
    } catch {
        return []
    }
}
