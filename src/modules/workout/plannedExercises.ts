// What the "Add exercise" picker of a Workout leads with, given its Template
// (ADR-0006, as amended by the UI plan): a Planned Workout lists its Template's
// Exercises first, then every other Exercise; an Unplanned Workout lists
// everything. Pure, so the rules are unit-tested without a renderer.

import type { Exercise } from '@/src/db/exercises'
import { resolveMembers } from '@/src/db/templateMembership'
import type { WorkoutTemplate } from '@/src/db/workoutTemplates'

type ExerciseLike = Pick<Exercise, 'id' | 'uuid'>

export type TemplatePriority = {
    // The Template's name for the picker's first section; null when there is
    // none (an Unplanned Workout, or a deleted Template).
    templateName: string | null
    // The Template's Exercises that still exist on this device.
    priorityUuids: string[]
}

export const resolveTemplatePriority = <E extends ExerciseLike>(input: {
    exercises: readonly E[]
    templateUuid: string | null | undefined
    template: Pick<WorkoutTemplate, 'name' | 'exercise_uuids'> | null
}): TemplatePriority => {
    const { exercises, templateUuid, template } = input
    if (!templateUuid || !template) return { templateName: null, priorityUuids: [] }
    const priorityUuids = resolveMembers(template.exercise_uuids, exercises).flatMap((exercise) =>
        exercise.uuid ? [exercise.uuid] : []
    )
    return { templateName: template.name, priorityUuids }
}
