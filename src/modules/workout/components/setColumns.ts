import type { ExerciseType } from '@/src/db/exercises'
import type { SetFormValues } from '../setPayload'

// The input columns of a set row, by ExerciseType: what a Set of that type
// records (its PrimaryMetric plus context). Pure so the matrix is tested
// directly and the row renders without branching.
export type SetColumn = {
    key: keyof SetFormValues
    labelKey: 'colKg' | 'colAddedKg' | 'colReps' | 'colDistance' | 'colMin' | 'colSec'
    keyboard: 'decimal-pad' | 'number-pad'
}

const WEIGHT: SetColumn = { key: 'weight', labelKey: 'colKg', keyboard: 'decimal-pad' }
// Bodyweight exercises record only the load added (a vest) or taken off (assistance).
const ADDED_WEIGHT: SetColumn = { key: 'weight', labelKey: 'colAddedKg', keyboard: 'decimal-pad' }
const REPS: SetColumn = { key: 'reps', labelKey: 'colReps', keyboard: 'number-pad' }
const DISTANCE: SetColumn = { key: 'distance', labelKey: 'colDistance', keyboard: 'decimal-pad' }
const MINUTES: SetColumn = { key: 'durationMinutes', labelKey: 'colMin', keyboard: 'number-pad' }
const SECONDS: SetColumn = { key: 'durationSeconds', labelKey: 'colSec', keyboard: 'number-pad' }

export const resolveSetColumns = (type: ExerciseType): SetColumn[] => {
    switch (type) {
        case 'weight':
            return [WEIGHT, REPS]
        case 'bodyweight':
            return [ADDED_WEIGHT, REPS]
        case 'bodyweight_timer':
            return [ADDED_WEIGHT, MINUTES, SECONDS]
        case 'cardio':
            return [DISTANCE, MINUTES, SECONDS]
    }
}

// Drop stages (SubSets) record weight and reps only.
export const SUB_SET_COLUMNS: SetColumn[] = [WEIGHT, REPS]
