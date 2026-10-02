// Pure rules behind the Workout Template editor: validation, the exercise
// search, and grouping the selectable list by muscle group.

import { normalizeExerciseName } from '@/src/data/dedup/exerciseDedup'
import type { Exercise } from '@/src/db/exercises'

export const TEMPLATE_NAME_MAX_LENGTH = 40

export type TemplateValidation =
    | { ok: true; name: string; exerciseUuids: string[] }
    | { ok: false; field: 'name' | 'exercises'; errorKey: 'templateNameRequired' | 'templateNeedsExercise' }

export const validateTemplate = (input: { name: string; exerciseUuids: readonly string[] }): TemplateValidation => {
    const name = input.name.trim()
    if (!name) return { ok: false, field: 'name', errorKey: 'templateNameRequired' }
    if (input.exerciseUuids.length === 0) return { ok: false, field: 'exercises', errorKey: 'templateNeedsExercise' }
    return { ok: true, name, exerciseUuids: [...input.exerciseUuids] }
}

// Only uuids that still resolve to a live Exercise are saved, so stale members
// left by deleted Exercises get pruned whenever the Template is re-saved.
export const liveSelection = (selected: ReadonlySet<string>, exercises: readonly Pick<Exercise, 'uuid'>[]): string[] =>
    exercises.flatMap((exercise) => (exercise.uuid && selected.has(exercise.uuid) ? [exercise.uuid] : []))

// Accent- and case-insensitive match on name or muscle group, so "bench" finds
// "Bench Press" and "hrudnik" finds "hrudník".
export const filterExercises = <E extends Pick<Exercise, 'name' | 'muscle_group'>>(
    exercises: readonly E[],
    query: string
): E[] => {
    const needle = normalizeExerciseName(query)
    if (!needle) return [...exercises]
    return exercises.filter(
        (exercise) =>
            normalizeExerciseName(exercise.name).includes(needle) ||
            normalizeExerciseName(exercise.muscle_group ?? '').includes(needle)
    )
}

export type ExerciseGroup<E> = { group: string | null; exercises: E[] }

// Sections keyed by muscle group, alphabetical, with ungrouped Exercises last.
// Within a section the caller's order (the user's Exercise-list order) is kept.
export const groupByMuscle = <E extends Pick<Exercise, 'muscle_group'>>(
    exercises: readonly E[]
): ExerciseGroup<E>[] => {
    const groups = new Map<string | null, E[]>()
    for (const exercise of exercises) {
        const key = exercise.muscle_group?.trim() || null
        const list = groups.get(key)
        if (list) list.push(exercise)
        else groups.set(key, [exercise])
    }
    return [...groups.entries()]
        .map(([group, list]) => ({ group, exercises: list }))
        .sort((a, b) => {
            if (a.group === null) return 1
            if (b.group === null) return -1
            return a.group.localeCompare(b.group)
        })
}

// Distinct muscle groups covered by a Template's Exercises, for a one-line
// summary such as "Chest · Triceps".
export const muscleGroupsOf = (exercises: readonly Pick<Exercise, 'muscle_group'>[]): string[] =>
    groupByMuscle(exercises).flatMap((section) => (section.group ? [section.group] : []))
