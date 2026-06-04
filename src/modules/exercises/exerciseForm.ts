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

export type ExerciseFormValidation = { ok: true } | { ok: false; nameError: string }

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
