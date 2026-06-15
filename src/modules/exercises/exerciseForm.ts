import type { ExerciseType } from '@/src/db/exercises'

/**
 * Pure form logic for the exercise add/edit screen.
 *
 * The screen owns IO (repository writes, photo persistence, navigation, toasts);
 * this module owns validation and the shape of the data those writes consume.
 */

export type ExerciseFormFields = {
    name: string
    muscle: string
    type: ExerciseType
    photoUri: string | null
}

export type ExerciseFormValidation = { ok: true } | { ok: false; nameError: 'enterName' }

/**
 * Validates the exercise form. The only required field is the name; an empty or
 * whitespace-only name fails with the `enterName` translation key.
 */
export function validateExerciseForm(fields: { name: string }): ExerciseFormValidation {
    if (!fields.name.trim()) {
        return { ok: false, nameError: 'enterName' }
    }
    return { ok: true }
}

export type ExerciseSavePayload = {
    name: string
    muscle_group: string | undefined
    type: ExerciseType
    photo_uri: string | null
}

/**
 * Builds the normalized payload persisted for an exercise: name trimmed, muscle
 * group trimmed/lowercased (or undefined when blank), type lowercased, photo uri
 * passed through unchanged.
 */
export function buildExerciseSavePayload(fields: ExerciseFormFields): ExerciseSavePayload {
    return {
        name: fields.name.trim(),
        muscle_group: fields.muscle.trim().toLowerCase() || undefined,
        type: fields.type.toLowerCase() as ExerciseType,
        photo_uri: fields.photoUri,
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
    | { kind: 'invalid'; nameError: 'enterName' }
    | { kind: 'create' }
    | { kind: 'update'; exerciseId: number }
    | { kind: 'noop' }

export function resolveExerciseSavePlan(input: {
    name: string
    isEditing: boolean
    resolvedExerciseId: number | undefined
}): ExerciseSavePlan {
    const validation = validateExerciseForm({ name: input.name })
    if (!validation.ok) {
        return { kind: 'invalid', nameError: validation.nameError }
    }
    if (!input.isEditing) {
        return { kind: 'create' }
    }
    if (input.resolvedExerciseId === undefined) {
        return { kind: 'noop' }
    }
    return { kind: 'update', exerciseId: input.resolvedExerciseId }
}

/** Translation keys + interpolated name for the success toast after a save. */
export type ExerciseSavedToast = {
    titleKey: 'exerciseUpdated' | 'exerciseCreated'
    messageNameKey: 'updated' | 'ready'
    name: string
}

/**
 * The success-toast content for a saved exercise: editing reports an update,
 * otherwise a creation. The screen passes the keys through i18n.
 */
export function resolveExerciseSavedToast(isEditing: boolean, name: string): ExerciseSavedToast {
    return isEditing
        ? { titleKey: 'exerciseUpdated', messageNameKey: 'updated', name }
        : { titleKey: 'exerciseCreated', messageNameKey: 'ready', name }
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
        { value: 'bodyweight', labelKey: 'typeBodyweight', isActive: type === 'bodyweight' || type === 'bodyweight_timer' },
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
