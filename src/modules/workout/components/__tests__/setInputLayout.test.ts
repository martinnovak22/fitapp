import { describe, expect, it } from 'vitest'
import { resolveSetInputLayout } from '../setInputLayout'

describe('resolveSetInputLayout', () => {
    it('shows weight + reps at half width for a weight exercise, no duration', () => {
        const layout = resolveSetInputLayout('weight')
        expect(layout.fields.map((f) => [f.key, f.minWidth, f.returnKey])).toEqual([
            ['weight', '46%', 'next'],
            ['reps', '46%', 'done'],
        ])
        expect(layout.duration).toBeNull()
    })

    it('treats bodyweight like weight (weight + reps, no duration)', () => {
        const layout = resolveSetInputLayout('bodyweight')
        expect(layout.fields.map((f) => f.key)).toEqual(['weight', 'reps'])
        expect(layout.duration).toBeNull()
    })

    it('shows a full-width weight and a full-width duration row for a bodyweight timer', () => {
        const layout = resolveSetInputLayout('bodyweight_timer')
        expect(layout.fields.map((f) => [f.key, f.minWidth])).toEqual([['weight', '100%']])
        expect(layout.duration?.minWidth).toBe('100%')
        expect(layout.duration?.fields.map((f) => [f.key, f.returnKey])).toEqual([
            ['durationMinutes', 'next'],
            ['durationSeconds', 'done'],
        ])
    })

    it('shows distance + a 65%-wide duration row for cardio, no weight or reps', () => {
        const layout = resolveSetInputLayout('cardio')
        expect(layout.fields.map((f) => f.key)).toEqual(['distance'])
        expect(layout.fields[0].minWidth).toBe('100%')
        expect(layout.duration?.minWidth).toBe('65%')
        expect(layout.duration?.fields.map((f) => f.key)).toEqual(['durationMinutes', 'durationSeconds'])
    })

    it('falls back to a single half-width weight field for an unknown/undefined type', () => {
        for (const layout of [resolveSetInputLayout(undefined), resolveSetInputLayout('mystery')]) {
            expect(layout.fields.map((f) => [f.key, f.minWidth])).toEqual([['weight', '46%']])
            expect(layout.duration).toBeNull()
        }
    })

    it('carries the i18n label key and placeholder for each field', () => {
        const cardio = resolveSetInputLayout('cardio')
        expect(cardio.fields[0]).toMatchObject({ labelKey: 'distM', placeholder: '0' })
        expect(cardio.duration?.fields[0]).toMatchObject({ labelKey: 'minutes', placeholder: '00' })
        expect(cardio.duration?.fields[1]).toMatchObject({ labelKey: 'seconds', placeholder: '00' })
    })
})
