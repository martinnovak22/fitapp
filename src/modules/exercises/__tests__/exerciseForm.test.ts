import { describe, expect, it } from 'vitest'
import {
    buildExerciseSavePayload,
    resolveExerciseSavedToast,
    resolveExerciseSavePlan,
    resolveExerciseTypeOptions,
    resolveTrackingModeToggle,
    shouldPersistPhoto,
    validateExerciseForm,
} from '../exerciseForm'

describe('validateExerciseForm', () => {
    it('rejects an empty name', () => {
        expect(validateExerciseForm({ name: '' })).toEqual({ ok: false, nameError: 'enterName' })
    })

    it('rejects a whitespace-only name', () => {
        expect(validateExerciseForm({ name: '   ' })).toEqual({ ok: false, nameError: 'enterName' })
    })

    it('accepts a name with content', () => {
        expect(validateExerciseForm({ name: 'Bench Press' })).toEqual({ ok: true })
    })

    it('accepts a name padded with whitespace', () => {
        expect(validateExerciseForm({ name: '  Squat  ' })).toEqual({ ok: true })
    })
})

describe('buildExerciseSavePayload', () => {
    it('trims the name', () => {
        const payload = buildExerciseSavePayload({
            name: '  Bench Press  ',
            muscle: '',
            type: 'weight',
            photoUri: null,
        })
        expect(payload.name).toBe('Bench Press')
    })

    it('trims and lowercases the muscle group', () => {
        const payload = buildExerciseSavePayload({
            name: 'Bench',
            muscle: '  CHEST ',
            type: 'weight',
            photoUri: null,
        })
        expect(payload.muscle_group).toBe('chest')
    })

    it('maps an empty muscle group to undefined', () => {
        const payload = buildExerciseSavePayload({
            name: 'Bench',
            muscle: '   ',
            type: 'weight',
            photoUri: null,
        })
        expect(payload.muscle_group).toBeUndefined()
    })

    it('lowercases the type', () => {
        const payload = buildExerciseSavePayload({
            name: 'Run',
            muscle: '',
            type: 'CARDIO' as never,
            photoUri: null,
        })
        expect(payload.type).toBe('cardio')
    })

    it('passes through a null photo uri', () => {
        const payload = buildExerciseSavePayload({
            name: 'Bench',
            muscle: '',
            type: 'weight',
            photoUri: null,
        })
        expect(payload.photo_uri).toBeNull()
    })

    it('passes through a photo uri', () => {
        const payload = buildExerciseSavePayload({
            name: 'Bench',
            muscle: '',
            type: 'weight',
            photoUri: 'file:///photo.jpg',
        })
        expect(payload.photo_uri).toBe('file:///photo.jpg')
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
        expect(resolveExerciseSavePlan({ name: '  ', isEditing: false, resolvedExerciseId: undefined })).toEqual({
            kind: 'invalid',
            nameError: 'enterName',
        })
    })

    it('plans a create when not editing', () => {
        expect(resolveExerciseSavePlan({ name: 'Bench', isEditing: false, resolvedExerciseId: undefined })).toEqual({
            kind: 'create',
        })
    })

    it('plans an update when editing with an id', () => {
        expect(resolveExerciseSavePlan({ name: 'Bench', isEditing: true, resolvedExerciseId: 7 })).toEqual({
            kind: 'update',
            exerciseId: 7,
        })
    })

    it('is a no-op when editing without a resolved id', () => {
        expect(resolveExerciseSavePlan({ name: 'Bench', isEditing: true, resolvedExerciseId: undefined })).toEqual({
            kind: 'noop',
        })
    })
})

describe('resolveExerciseSavedToast', () => {
    it('uses the created keys when not editing', () => {
        expect(resolveExerciseSavedToast(false, 'Bench')).toEqual({
            titleKey: 'exerciseCreated',
            messageNameKey: 'ready',
            name: 'Bench',
        })
    })

    it('uses the updated keys when editing', () => {
        expect(resolveExerciseSavedToast(true, 'Bench')).toEqual({
            titleKey: 'exerciseUpdated',
            messageNameKey: 'updated',
            name: 'Bench',
        })
    })
})

describe('resolveExerciseTypeOptions', () => {
    it('marks the matching type active', () => {
        const options = resolveExerciseTypeOptions('cardio')
        expect(options.map((o) => o.value)).toEqual(['weight', 'cardio', 'bodyweight'])
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
