import { describe, expect, it } from 'vitest'
import { buildExerciseSavePayload, validateExerciseForm } from '../exerciseForm'

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
