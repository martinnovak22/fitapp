import type { TFunction } from 'i18next'
import type { Exercise } from '@/src/db/exercises'
import { resolveMembers } from '@/src/db/templateMembership'
import type { WorkoutTemplate } from '@/src/db/workoutTemplates'
import type { MuscleGroup } from '@/src/domain/exerciseTaxonomy'
import { muscleGroupsOf } from '@/src/modules/exercises/exerciseFilters'
import { muscleGroupLabel } from '@/src/modules/exercises/taxonomyLabels'

// What a Template list row shows: how many of its Exercises still exist and
// which muscle groups they cover.
export type TemplateSummary = {
    template: WorkoutTemplate
    exerciseCount: number
    muscleGroups: MuscleGroup[]
}

export const summarizeTemplates = (
    templates: readonly WorkoutTemplate[],
    exercises: readonly Exercise[]
): TemplateSummary[] =>
    templates.map((template) => {
        const members = resolveMembers(template.exercise_uuids, exercises)
        return { template, exerciseCount: members.length, muscleGroups: muscleGroupsOf(members) }
    })

// The line under a plan's name: "3 exercises · Chest, Back".
export const templateSubtitle = (t: TFunction, summary: TemplateSummary): string =>
    [
        t('exercisesCount', { count: summary.exerciseCount }),
        ...(summary.muscleGroups.length > 0
            ? [summary.muscleGroups.map((group) => muscleGroupLabel(t, group)).join(', ')]
            : []),
    ].join(' · ')

// Up to two initials for a plan's avatar: "Push A" → "PA", "Monday" → "M".
export const planInitials = (name: string): string =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0).toLocaleUpperCase())
        .join('')
