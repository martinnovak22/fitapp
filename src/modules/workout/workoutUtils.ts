import type { SubSet } from '@/src/db/workouts'

export const SET_BASE_HEIGHT = 56
export const SUBSET_HEIGHT = 32

export function parseSubSets(subSetsJson: string | null | undefined): SubSet[] {
    if (!subSetsJson) return []
    try {
        const parsed = JSON.parse(subSetsJson)
        return Array.isArray(parsed) ? (parsed as SubSet[]) : []
    } catch {
        return []
    }
}

/**
 * Calculates the total height of a workout set based on its sub-sets.
 */
export function calculateSetHeight(subSetsJson: string | null | undefined): number {
    const subSets = parseSubSets(subSetsJson)
    return SET_BASE_HEIGHT + subSets.length * SUBSET_HEIGHT
}
