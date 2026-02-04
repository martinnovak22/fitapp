export const SET_BASE_HEIGHT = 56;
export const SUBSET_HEIGHT = 32;

/**
 * Calculates the total height of a workout set based on its sub-sets.
 */
export function calculateSetHeight(subSetsJson: string | null | undefined): number {
    if (!subSetsJson) return SET_BASE_HEIGHT;
    try {
        const subSets = JSON.parse(subSetsJson);
        return SET_BASE_HEIGHT + (Array.isArray(subSets) ? subSets.length * SUBSET_HEIGHT : 0);
    } catch (e) {
        return SET_BASE_HEIGHT;
    }
}
