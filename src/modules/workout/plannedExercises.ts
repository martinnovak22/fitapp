// Which Exercises the set picker offers, given the Workout's Template (ADR-0006).
// Pure, so the rules are unit-tested without a renderer.

import type { Exercise } from '@/src/db/exercises'
import type { WorkoutTemplate } from '@/src/db/workoutTemplates'

type ExerciseLike = Pick<Exercise, 'id' | 'uuid'>

// The Template's members that still resolve to a live Exercise, in the user's
// Exercise-list order. Unknown uuids (deleted or not yet pulled) are skipped.
export const resolveTemplateExercises = <E extends ExerciseLike>(
    template: Pick<WorkoutTemplate, 'exercise_uuids'>,
    exercises: readonly E[]
): E[] => {
    const members = new Set(template.exercise_uuids)
    return exercises.filter((exercise) => !!exercise.uuid && members.has(exercise.uuid))
}

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

    const members = new Set(template.exercise_uuids)
    const logged = new Set(input.loggedExerciseIds)
    const picked = exercises.filter(
        (exercise) => (!!exercise.uuid && members.has(exercise.uuid)) || logged.has(exercise.id)
    )
    if (picked.length === 0) {
        return { exercises: [...exercises], scope: { kind: 'planned-fallback', templateName: template.name } }
    }
    return { exercises: picked, scope: { kind: 'planned', templateName: template.name } }
}
