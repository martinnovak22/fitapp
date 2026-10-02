import type { Exercise } from '@/src/db/exercises'
import { resolveMembers } from '@/src/db/templateMembership'
import type { WorkoutTemplate } from '@/src/db/workoutTemplates'
import { muscleGroupsOf } from './templateForm'

// What a Template list row shows: how many of its Exercises still exist and
// which muscle groups they cover.
export type TemplateSummary = {
    template: WorkoutTemplate
    exerciseCount: number
    muscleGroups: string[]
}

export const summarizeTemplates = (
    templates: readonly WorkoutTemplate[],
    exercises: readonly Exercise[]
): TemplateSummary[] =>
    templates.map((template) => {
        const members = resolveMembers(template.exercise_uuids, exercises)
        return { template, exerciseCount: members.length, muscleGroups: muscleGroupsOf(members) }
    })
