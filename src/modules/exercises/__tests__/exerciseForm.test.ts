import { describe, expect, it } from 'vitest'
import {
    buildExerciseSavePayload,
    changedTaxonomyOnly,
    NO_SUGGESTIONS,
    resolveExerciseSavePlan,
    resolveExerciseTypeOptions,
    resolveTrackingModeToggle,
    shouldPersistPhoto,
    suggestTaxonomyForType,
    validateExerciseForm,
} from '../exerciseForm'

describe('validateExerciseForm', () => {
    it('rejects an empty or whitespace-only name', () => {
        expect(validateExerciseForm({ name: '', primaryMuscle: 'chest' })).toEqual({
            ok: false,
            nameError: 'enterName',
        })
        expect(validateExerciseForm({ name: '   ', primaryMuscle: 'chest' })).toEqual({
            ok: false,
            nameError: 'enterName',
        })
    })

    it('requires a primary Muscle', () => {
        expect(validateExerciseForm({ name: 'Bench', primaryMuscle: null })).toEqual({
            ok: false,
            primaryMuscleError: 'primaryMuscleRequired',
        })
    })

    it('reports both errors at once', () => {
        expect(validateExerciseForm({ name: '', primaryMuscle: null })).toEqual({
            ok: false,
            nameError: 'enterName',
            primaryMuscleError: 'primaryMuscleRequired',
        })
    })

    it('accepts a padded name with a primary Muscle', () => {
        expect(validateExerciseForm({ name: '  Squat  ', primaryMuscle: 'quads' })).toEqual({ ok: true })
    })
})

const fields = {
    name: 'Bench',
    primaryMuscle: 'chest' as const,
    secondaryMuscles: [],
    equipment: null,
    type: 'weight' as const,
    photoUri: null,
}

describe('buildExerciseSavePayload', () => {
    it('trims the name and lowercases the type', () => {
        const payload = buildExerciseSavePayload({ ...fields, name: '  Bench Press  ', type: 'WEIGHT' as never })
        expect(payload.name).toBe('Bench Press')
        expect(payload.type).toBe('weight')
    })

    it('carries the Muscles and Equipment, dropping the primary from the secondary list', () => {
        const payload = buildExerciseSavePayload({
            ...fields,
            secondaryMuscles: ['triceps', 'chest', 'front_delts'],
            equipment: 'barbell',
        })
        expect(payload).toMatchObject({
            muscles: { primary: 'chest', secondary: ['triceps', 'front_delts'] },
            equipment: 'barbell',
        })
    })

    it('passes the photo uri through', () => {
        expect(buildExerciseSavePayload(fields).photoUri).toBeNull()
        expect(buildExerciseSavePayload({ ...fields, photoUri: 'file:///photo.jpg' }).photoUri).toBe(
            'file:///photo.jpg'
        )
    })
})

describe('changedTaxonomyOnly', () => {
    const loaded = { primaryMuscle: 'chest' as const, secondaryMuscles: ['triceps' as const], equipment: null }
    const payload = buildExerciseSavePayload({
        ...fields,
        name: 'Bench Press',
        secondaryMuscles: ['triceps'],
    })

    it('leaves Muscles and Equipment out of a name-only edit', () => {
        expect(changedTaxonomyOnly(payload, loaded)).toEqual({ name: 'Bench Press', type: 'weight', photoUri: null })
    })

    it('sends the Muscles when the primary or the secondary list changed', () => {
        expect(
            changedTaxonomyOnly(buildExerciseSavePayload({ ...fields, secondaryMuscles: ['front_delts'] }), loaded)
        ).toHaveProperty('muscles', { primary: 'chest', secondary: ['front_delts'] })
        expect(
            changedTaxonomyOnly(buildExerciseSavePayload({ ...fields, primaryMuscle: 'lats' }), loaded)
        ).toHaveProperty('muscles')
    })

    it('sends Equipment when it changed, including a clear', () => {
        expect(changedTaxonomyOnly({ ...payload, equipment: 'barbell' }, loaded)).toHaveProperty('equipment', 'barbell')
        expect(
            changedTaxonomyOnly({ ...payload, equipment: null }, { ...loaded, equipment: 'barbell' })
        ).toHaveProperty('equipment', null)
    })
})

describe('suggestTaxonomyForType', () => {
    const empty = { primaryMuscle: null, equipment: null, suggested: NO_SUGGESTIONS }

    it('suggests bodyweight Equipment for a bodyweight exercise', () => {
        expect(suggestTaxonomyForType('bodyweight_timer', empty)).toEqual({
            primaryMuscle: null,
            equipment: 'bodyweight',
            suggested: { primaryMuscle: false, equipment: true },
        })
    })

    it('suggests the cardio Muscle for a cardio exercise', () => {
        expect(suggestTaxonomyForType('cardio', empty).primaryMuscle).toBe('cardio')
    })

    it('withdraws its own suggestion when the type changes back', () => {
        const afterCardio = suggestTaxonomyForType('cardio', empty)
        expect(suggestTaxonomyForType('weight', afterCardio)).toEqual(empty)
        const afterBodyweight = suggestTaxonomyForType('bodyweight', empty)
        expect(suggestTaxonomyForType('weight', afterBodyweight).equipment).toBeNull()
    })

    it('never overrides a choice the user made', () => {
        const chosen = { primaryMuscle: 'lats' as const, equipment: 'band' as const, suggested: NO_SUGGESTIONS }
        expect(suggestTaxonomyForType('cardio', chosen)).toEqual(chosen)
        expect(suggestTaxonomyForType('bodyweight', chosen)).toEqual(chosen)
    })
})

describe('shouldPersistPhoto', () => {
    it('is false when there is no photo', () => {
        expect(shouldPersistPhoto(null, 'file:///docs/')).toBe(false)
    })

    it('is false when there is no document directory', () => {
        expect(shouldPersistPhoto('file:///tmp/x.jpg', null)).toBe(false)
    })

    it('is false when the photo already lives in the document directory', () => {
        expect(shouldPersistPhoto('file:///docs/exercises/x.jpg', 'file:///docs/')).toBe(false)
    })

    it('is true for a transient photo outside the document directory', () => {
        expect(shouldPersistPhoto('file:///tmp/x.jpg', 'file:///docs/')).toBe(true)
    })
})

describe('resolveExerciseSavePlan', () => {
    it('returns invalid with the name error for an empty name', () => {
        expect(
            resolveExerciseSavePlan({
                name: '  ',
                primaryMuscle: 'chest',
                isEditing: false,
                resolvedExerciseId: undefined,
            })
        ).toEqual({
            kind: 'invalid',
            nameError: 'enterName',
        })
    })

    it('returns invalid with the muscle error when no primary Muscle is picked', () => {
        expect(
            resolveExerciseSavePlan({ name: 'Bench', primaryMuscle: null, isEditing: true, resolvedExerciseId: 7 })
        ).toEqual({
            kind: 'invalid',
            primaryMuscleError: 'primaryMuscleRequired',
        })
    })

    it('plans a create when not editing', () => {
        expect(
            resolveExerciseSavePlan({
                name: 'Bench',
                primaryMuscle: 'chest',
                isEditing: false,
                resolvedExerciseId: undefined,
            })
        ).toEqual({
            kind: 'create',
        })
    })

    it('plans an update when editing with an id', () => {
        expect(
            resolveExerciseSavePlan({ name: 'Bench', primaryMuscle: 'chest', isEditing: true, resolvedExerciseId: 7 })
        ).toEqual({
            kind: 'update',
            exerciseId: 7,
        })
    })

    it('is a no-op when editing without a resolved id', () => {
        expect(
            resolveExerciseSavePlan({
                name: 'Bench',
                primaryMuscle: 'chest',
                isEditing: true,
                resolvedExerciseId: undefined,
            })
        ).toEqual({
            kind: 'noop',
        })
    })
})

describe('resolveExerciseTypeOptions', () => {
    it('marks the matching type active', () => {
        const options = resolveExerciseTypeOptions('cardio')
        expect(options.map((o) => o.value)).toEqual(['weight', 'bodyweight', 'cardio'])
        expect(options.find((o) => o.value === 'cardio')?.isActive).toBe(true)
        expect(options.find((o) => o.value === 'weight')?.isActive).toBe(false)
    })

    it('treats bodyweight_timer as the bodyweight option being active', () => {
        const options = resolveExerciseTypeOptions('bodyweight_timer')
        expect(options.find((o) => o.value === 'bodyweight')?.isActive).toBe(true)
    })
})

describe('resolveTrackingModeToggle', () => {
    it('is null for non-bodyweight types', () => {
        expect(resolveTrackingModeToggle('weight')).toBeNull()
        expect(resolveTrackingModeToggle('cardio')).toBeNull()
    })

    it('marks reps active for bodyweight', () => {
        const toggle = resolveTrackingModeToggle('bodyweight')
        expect(toggle).not.toBeNull()
        expect(toggle?.find((o) => o.value === 'bodyweight')?.isActive).toBe(true)
        expect(toggle?.find((o) => o.value === 'bodyweight_timer')?.isActive).toBe(false)
    })

    it('marks timer active for bodyweight_timer', () => {
        const toggle = resolveTrackingModeToggle('bodyweight_timer')
        expect(toggle?.find((o) => o.value === 'bodyweight_timer')?.isActive).toBe(true)
    })
})
