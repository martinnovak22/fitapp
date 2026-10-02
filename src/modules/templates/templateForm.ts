// Pure rules behind the Workout Template editor: validation, the exercise
// search, and grouping the selectable list by muscle group.

import { normalizeExerciseName } from '@/src/data/dedup/exerciseDedup'
import type { Exercise } from '@/src/db/exercises'
import { compareMuscleGroups, type MuscleGroup, resolveExerciseMuscleGroup } from '@/src/domain/exerciseTaxonomy'

export const TEMPLATE_NAME_MAX_LENGTH = 40

export type TemplateValidation =
    | { ok: true; name: string; exerciseUuids: string[] }
    | { ok: false; field: 'name' | 'exercises'; errorKey: 'templateNameRequired' | 'templateNeedsExercise' }

// `exerciseUuids` is the whole selection, kept verbatim: members whose Exercise
// is not on this device yet (not pulled, or parked) must survive a save, or the
// last-writer-wins push would strip them from every device. Only the live
// members count towards "at least one Exercise".
export const validateTemplate = (input: {
    name: string
    exerciseUuids: readonly string[]
    liveMemberCount: number
}): TemplateValidation => {
    const name = input.name.trim()
    if (!name) return { ok: false, field: 'name', errorKey: 'templateNameRequired' }
    if (input.liveMemberCount === 0) return { ok: false, field: 'exercises', errorKey: 'templateNeedsExercise' }
    return { ok: true, name, exerciseUuids: [...input.exerciseUuids] }
}

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
