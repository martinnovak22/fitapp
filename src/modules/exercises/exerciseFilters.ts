// Pure rules for finding Exercises in a list: text search, Muscle Group and
// Equipment facets, and grouping by Muscle Group. Shared by the exercise
// picker, the plan editor and the plan summaries.

import { normalizeExerciseName } from '@/src/data/dedup/exerciseDedup'
import type { Exercise } from '@/src/db/exercises'
import {
    asEquipment,
    compareMuscleGroups,
    type Equipment,
    type MuscleGroup,
    resolveExerciseMuscleGroup,
} from '@/src/domain/exerciseTaxonomy'

// Accent- and case-insensitive match on the name, the legacy muscle text, or
// any extra searchable text the caller supplies (the localized Muscle labels),
// so "bench" finds "Bench Press" and "hrudnik" finds a chest Exercise.
export const filterExercises = <E extends Pick<Exercise, 'name' | 'muscle_group'>>(
    exercises: readonly E[],
    query: string,
    extraSearchText: (exercise: E) => readonly string[] = () => []
): E[] => {
    const needle = normalizeExerciseName(query)
    if (!needle) return [...exercises]
    return exercises.filter((exercise) =>
        [exercise.name, exercise.muscle_group ?? '', ...extraSearchText(exercise)].some((text) =>
            normalizeExerciseName(text).includes(needle)
        )
    )
}

export type ExerciseGroup<E> = { group: MuscleGroup | null; exercises: E[] }

type GroupableExercise = Pick<Exercise, 'muscle_group' | 'primary_muscle' | 'secondary_muscles'>

// Sections keyed by Muscle Group in taxonomy order (chest, back, … cardio),
// with unclassified Exercises last. Within a section the caller's order (the
// user's Exercise-list order) is kept.
export const groupByMuscle = <E extends GroupableExercise>(exercises: readonly E[]): ExerciseGroup<E>[] => {
    const groups = new Map<MuscleGroup | null, E[]>()
    for (const exercise of exercises) {
        const key = resolveExerciseMuscleGroup(exercise)
        const list = groups.get(key)
        if (list) list.push(exercise)
        else groups.set(key, [exercise])
    }
    return [...groups.entries()]
        .map(([group, list]) => ({ group, exercises: list }))
        .sort((a, b) => compareMuscleGroups(a.group, b.group))
}

// Distinct Muscle Groups covered by a Template's Exercises, in taxonomy order,
// for a one-line summary such as "Chest, Arms".
export const muscleGroupsOf = (exercises: readonly GroupableExercise[]): MuscleGroup[] =>
    groupByMuscle(exercises).flatMap((section) => (section.group ? [section.group] : []))

export type ExerciseFacets = {
    muscleGroup: MuscleGroup | null
    equipment: Equipment | null
}

export const NO_FACETS: ExerciseFacets = { muscleGroup: null, equipment: null }

type FacetableExercise = Pick<Exercise, 'muscle_group' | 'primary_muscle' | 'secondary_muscles' | 'equipment'>

// Narrows by the primary Muscle's group and by Equipment; a null facet means
// "any".
export const filterByFacets = <E extends FacetableExercise>(exercises: readonly E[], facets: ExerciseFacets): E[] =>
    exercises.filter(
        (exercise) =>
            (facets.muscleGroup === null || resolveExerciseMuscleGroup(exercise) === facets.muscleGroup) &&
            (facets.equipment === null || asEquipment(exercise.equipment) === facets.equipment)
    )

export type PickerSection<E> = { key: string; group: MuscleGroup | null; isPriority: boolean; exercises: E[] }

// The picker's sections: the priority Exercises first (a Planned Workout's
// plan), then the rest by Muscle Group. An Exercise is listed once.
export const buildPickerSections = <E extends FacetableExercise & Pick<Exercise, 'uuid'>>(
    exercises: readonly E[],
    priorityUuids: readonly string[] = []
): PickerSection<E>[] => {
    const priority = new Set(priorityUuids)
    const first = exercises.filter((exercise) => exercise.uuid && priority.has(exercise.uuid))
    const rest = exercises.filter((exercise) => !(exercise.uuid && priority.has(exercise.uuid)))
    const sections: PickerSection<E>[] = []
    if (first.length > 0) sections.push({ key: '__priority', group: null, isPriority: true, exercises: first })
    for (const section of groupByMuscle(rest)) {
        sections.push({
            key: section.group ?? '__other',
            group: section.group,
            isPriority: false,
            exercises: section.exercises,
        })
    }
    return sections
}
