// The dashboard's per-Muscle-Group view of training, counted by each Set's
// Exercise's primary Muscle (ADR-0007). Pure, so the counting rules are tested
// without the screen.

import {
    compareMuscleGroups,
    type ExerciseTaxonomyFields,
    type MuscleGroup,
    resolveExerciseMuscleGroup,
} from '@/src/domain/exerciseTaxonomy'

export type MuscleBalanceEntry = { group: MuscleGroup | null; count: number }

// Distinct Muscle Groups trained, in taxonomy order; unclassified is skipped.
export const muscleGroupsTrained = (sets: readonly ExerciseTaxonomyFields[]): MuscleGroup[] =>
    [...new Set(sets.map(resolveExerciseMuscleGroup))]
        .filter((group): group is MuscleGroup => group !== null)
        .sort(compareMuscleGroups)

// Sets per Muscle Group. Every group the user has an Exercise for is seeded at
// 0 so untrained groups stay visible; most-trained first, then taxonomy order.
export const computeMuscleBalance = (
    exercises: readonly ExerciseTaxonomyFields[],
    sets: readonly ExerciseTaxonomyFields[]
): MuscleBalanceEntry[] => {
    const counts = new Map<MuscleGroup | null, number>()
    for (const exercise of exercises) {
        const group = resolveExerciseMuscleGroup(exercise)
        if (group) counts.set(group, 0)
    }
    for (const set of sets) {
        const group = resolveExerciseMuscleGroup(set)
        counts.set(group, (counts.get(group) ?? 0) + 1)
    }
    return [...counts.entries()]
        .map(([group, count]) => ({ group, count }))
        .sort((a, b) => b.count - a.count || compareMuscleGroups(a.group, b.group))
}
