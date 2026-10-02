// Which Exercises the set picker offers, given the Workout's Template (ADR-0006).
// Pure, so the rules are unit-tested without a renderer.

import type { Exercise } from '@/src/db/exercises'
import { resolveMembers } from '@/src/db/templateMembership'
import type { WorkoutTemplate } from '@/src/db/workoutTemplates'

type ExerciseLike = Pick<Exercise, 'id' | 'uuid'>

export type PickerScope =
    // No Template: every Exercise.
    | { kind: 'unplanned' }
    // The Template's Exercises, plus any already logged in this Workout.
    | { kind: 'planned'; templateName: string }
    // The Workout was planned, but its Template no longer resolves (deleted) or
    // none of its Exercises are left: fall back to everything rather than
    // dead-ending the picker.
    | { kind: 'planned-fallback'; templateName: string | null }

export type PickerExercises<E> = { exercises: E[]; scope: PickerScope }

export const resolvePickerExercises = <E extends ExerciseLike>(input: {
    exercises: readonly E[]
    templateUuid: string | null | undefined
    template: Pick<WorkoutTemplate, 'name' | 'exercise_uuids'> | null
    // Exercises that already have a Set in this Workout. Kept selectable so an
    // older Set can still be edited after the Template changed.
    loggedExerciseIds: Iterable<number>
}): PickerExercises<E> => {
    const { exercises, templateUuid, template } = input
    if (!templateUuid) return { exercises: [...exercises], scope: { kind: 'unplanned' } }
    if (!template) return { exercises: [...exercises], scope: { kind: 'planned-fallback', templateName: null } }

    const members = new Set(resolveMembers(template.exercise_uuids, exercises))
    const logged = new Set(input.loggedExerciseIds)
    const picked = exercises.filter((exercise) => members.has(exercise) || logged.has(exercise.id))
    if (picked.length === 0) {
        return { exercises: [...exercises], scope: { kind: 'planned-fallback', templateName: template.name } }
    }
    return { exercises: picked, scope: { kind: 'planned', templateName: template.name } }
}

// Which Exercise the add-set modal should open on. The remembered selection is
// kept while the picker still offers it; otherwise (the plan was edited
// meanwhile) it lands on the first offered Exercise.
export const resolveAddSelection = (
    selectedId: number | null,
    offered: readonly Pick<Exercise, 'id'>[]
): number | null => {
    if (selectedId !== null && offered.some((exercise) => exercise.id === selectedId)) return selectedId
    return offered[0]?.id ?? null
}

// The caption above a narrowed picker, as an i18n key plus its values.
export const pickerCaption = (
    scope: PickerScope
): { key: 'pickerFromPlan'; name: string } | { key: 'pickerPlanFallback' } | null => {
    switch (scope.kind) {
        case 'planned':
            return { key: 'pickerFromPlan', name: scope.templateName }
        case 'planned-fallback':
            return { key: 'pickerPlanFallback' }
        default:
            return null
    }
}
