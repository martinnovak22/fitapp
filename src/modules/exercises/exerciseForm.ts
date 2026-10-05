import type { ExerciseType, ExerciseUpdate } from '@/src/db/exercises'
import type { Equipment, MuscleKey } from '@/src/domain/exerciseTaxonomy'

/**
 * Pure form logic for the exercise add/edit screen.
 *
 * The screen owns IO (repository writes, photo persistence, navigation, toasts);
 * this module owns validation and the shape of the data those writes consume.
 */

export type ExerciseFormFields = {
    name: string
    primaryMuscle: MuscleKey | null
    secondaryMuscles: MuscleKey[]
    equipment: Equipment | null
    type: ExerciseType
    photoUri: string | null
}

export type ExerciseFormErrors = {
    nameError?: 'enterName'
    primaryMuscleError?: 'primaryMuscleRequired'
}

export type ExerciseFormValidation = { ok: true } | ({ ok: false } & ExerciseFormErrors)

/**
 * Validates the exercise form. A name and a primary Muscle are required
 * (ADR-0007); each missing field reports its own translation key.
 */
export function validateExerciseForm(fields: {
    name: string
    primaryMuscle: MuscleKey | null
}): ExerciseFormValidation {
    const errors: ExerciseFormErrors = {}
    if (!fields.name.trim()) errors.nameError = 'enterName'
    if (!fields.primaryMuscle) errors.primaryMuscleError = 'primaryMuscleRequired'
    return Object.keys(errors).length > 0 ? { ok: false, ...errors } : { ok: true }
}

// Shaped as an ExerciseUpdate so the same payload feeds both create and update.
export type ExerciseSavePayload = Required<Pick<ExerciseUpdate, 'name' | 'type' | 'photoUri' | 'muscles' | 'equipment'>>

/**
 * Builds the normalized payload persisted for an exercise: name trimmed, type
 * lowercased, secondary Muscles without the primary one, the rest passed through.
 */
export function buildExerciseSavePayload(fields: ExerciseFormFields): ExerciseSavePayload {
    return {
        name: fields.name.trim(),
        type: fields.type.toLowerCase() as ExerciseType,
        photoUri: fields.photoUri,
        muscles: {
            primary: fields.primaryMuscle,
            secondary: fields.secondaryMuscles.filter((key) => key !== fields.primaryMuscle),
        },
        equipment: fields.equipment,
    }
}

// The taxonomy values an edit form opened with, to tell what the user changed.
export type LoadedTaxonomy = {
    primaryMuscle: MuscleKey | null
    secondaryMuscles: MuscleKey[]
    equipment: Equipment | null
}

const sameMuscles = (a: readonly MuscleKey[], b: readonly MuscleKey[]) =>
    a.length === b.length && a.every((key, index) => key === b[index])

/**
 * The update an edit actually writes: Muscles and Equipment only when the user
 * changed them. A form opened on an Exercise carrying keys this client doesn't
 * know shows the nearest known values; re-sending those on a name-only edit
 * would overwrite a newer client's keys (ADR-0007).
 */
export function changedTaxonomyOnly(payload: ExerciseSavePayload, loaded: LoadedTaxonomy): ExerciseUpdate {
    const { muscles, equipment, ...rest } = payload
    const musclesChanged =
        muscles.primary !== loaded.primaryMuscle || !sameMuscles(muscles.secondary, loaded.secondaryMuscles)
    return {
        ...rest,
        ...(musclesChanged ? { muscles } : {}),
        ...(equipment !== loaded.equipment ? { equipment } : {}),
    }
}

export type TaxonomySuggestionState = {
    primaryMuscle: MuscleKey | null
    equipment: Equipment | null
    // Which of the two values came from a suggestion rather than the user.
    suggested: { primaryMuscle: boolean; equipment: boolean }
}

export const NO_SUGGESTIONS: TaxonomySuggestionState['suggested'] = { primaryMuscle: false, equipment: false }

/**
 * Smart defaults when the ExerciseType changes on a *new* exercise: a
 * bodyweight exercise most likely uses bodyweight Equipment, and a cardio
 * exercise most likely trains "cardio". A value the user chose is never
 * overridden; a value that was itself only a suggestion is re-evaluated, so
 * tapping Cardio by mistake and then Weight doesn't leave "cardio" behind.
 */
export function suggestTaxonomyForType(type: ExerciseType, current: TaxonomySuggestionState): TaxonomySuggestionState {
    const isBodyweight = type === 'bodyweight' || type === 'bodyweight_timer'
    const suggestedPrimary: MuscleKey | null = type === 'cardio' ? 'cardio' : null
    const suggestedEquipment: Equipment | null = isBodyweight ? 'bodyweight' : null

    const keepPrimary = current.primaryMuscle !== null && !current.suggested.primaryMuscle
    const keepEquipment = current.equipment !== null && !current.suggested.equipment
    return {
        primaryMuscle: keepPrimary ? current.primaryMuscle : suggestedPrimary,
        equipment: keepEquipment ? current.equipment : suggestedEquipment,
        suggested: {
            primaryMuscle: !keepPrimary && suggestedPrimary !== null,
            equipment: !keepEquipment && suggestedEquipment !== null,
        },
    }
}

/**
 * Whether a picked photo still needs to be copied into permanent app storage.
 * A photo is persisted only when it exists, the document directory is known, and
 * the uri does not already point inside that directory.
 */
export function shouldPersistPhoto(photoUri: string | null, docDir: string | null): boolean {
    if (!photoUri || !docDir) return false
    return !photoUri.includes(docDir)
}

/**
 * The save decision for a validated submit: which repository write to perform.
 * `invalid` carries the field error; `noop` covers an edit with no resolved id;
 * `create`/`update` tell the screen which write path to take.
 */
export type ExerciseSavePlan =
    | ({ kind: 'invalid' } & ExerciseFormErrors)
    | { kind: 'create' }
    | { kind: 'update'; exerciseId: number }
    | { kind: 'noop' }

export function resolveExerciseSavePlan(input: {
    name: string
    primaryMuscle: MuscleKey | null
    isEditing: boolean
    resolvedExerciseId: number | undefined
}): ExerciseSavePlan {
    const validation = validateExerciseForm(input)
    if (!validation.ok) {
        const { ok: _ok, ...errors } = validation
        return { kind: 'invalid', ...errors }
    }
    if (!input.isEditing) {
        return { kind: 'create' }
    }
    if (input.resolvedExerciseId === undefined) {
        return { kind: 'noop' }
    }
    return { kind: 'update', exerciseId: input.resolvedExerciseId }
}

/** A selectable exercise type chip with its active state for the current type. */
export type ExerciseTypeOption = {
    value: ExerciseType
    labelKey: 'typeWeight' | 'typeCardio' | 'typeBodyweight'
    isActive: boolean
}

/**
 * The three primary exercise-type chips with their active state. `bodyweight_timer`
 * shares the `bodyweight` chip, so that chip reads active for both bodyweight modes.
 */
export function resolveExerciseTypeOptions(type: ExerciseType): ExerciseTypeOption[] {
    const options: ExerciseTypeOption[] = [
        { value: 'weight', labelKey: 'typeWeight', isActive: type === 'weight' },
        { value: 'cardio', labelKey: 'typeCardio', isActive: type === 'cardio' },
        {
            value: 'bodyweight',
            labelKey: 'typeBodyweight',
            isActive: type === 'bodyweight' || type === 'bodyweight_timer',
        },
    ]
    return options
}

/** A reps/timer tracking-mode toggle option with its active state. */
export type TrackingModeOption = {
    value: Extract<ExerciseType, 'bodyweight' | 'bodyweight_timer'>
    labelKey: 'reps' | 'timer'
    isActive: boolean
}

/**
 * The reps/timer sub-toggle shown only for bodyweight exercises; null for any
 * other type, which is how the screen decides whether to render it at all.
 */
export function resolveTrackingModeToggle(type: ExerciseType): TrackingModeOption[] | null {
    if (type !== 'bodyweight' && type !== 'bodyweight_timer') {
        return null
    }
    return [
        { value: 'bodyweight', labelKey: 'reps', isActive: type === 'bodyweight' },
        { value: 'bodyweight_timer', labelKey: 'timer', isActive: type === 'bodyweight_timer' },
    ]
}
