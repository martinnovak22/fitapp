// Localized labels for the exercise taxonomy (ADR-0007). Keys are fixed in
// src/domain/exerciseTaxonomy.ts; each has a `muscle_<key>` or
// `equipment_<key>` entry in every locale.

import type { TFunction } from 'i18next'
import type { Exercise } from '@/src/db/exercises'
import {
    asEquipment,
    type Equipment,
    type ExerciseTaxonomyFields,
    type MuscleGroup,
    type MuscleKey,
    resolveExerciseMuscles,
} from '@/src/domain/exerciseTaxonomy'
import { formatExerciseType } from '@/src/utils/formatters'

export const muscleLabel = (t: TFunction, key: MuscleKey): string => t(`muscle_${key}`)

export const muscleGroupLabel = (t: TFunction, group: MuscleGroup | null): string =>
    group ? t(`muscle_${group}`) : t('unclassifiedMuscle')

export const equipmentLabel = (t: TFunction, equipment: Equipment): string => t(`equipment_${equipment}`)

// The primary Muscle's label, or "Unclassified" for legacy text that maps to
// no Muscle.
export const exerciseMuscleLabel = (t: TFunction, exercise: ExerciseTaxonomyFields): string => {
    const { primary } = resolveExerciseMuscles(exercise)
    return primary ? muscleLabel(t, primary) : t('unclassifiedMuscle')
}

// The one-line description under an Exercise's name, the same on every list:
// its primary Muscle, then its Equipment or (when it has none) its type.
export const exerciseSummaryLine = (t: TFunction, exercise: Exercise): string => {
    const equipment = asEquipment(exercise.equipment)
    return [
        exerciseMuscleLabel(t, exercise),
        equipment ? equipmentLabel(t, equipment) : t(formatExerciseType(exercise.type)),
    ].join(' • ')
}
