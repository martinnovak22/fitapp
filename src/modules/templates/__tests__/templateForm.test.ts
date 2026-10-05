import { describe, expect, it } from 'vitest'
import { validateTemplate } from '../templateForm'

describe('validateTemplate', () => {
    it('requires a name', () => {
        expect(validateTemplate({ name: '   ', exerciseUuids: ['a'], liveMemberCount: 1 })).toEqual({
            ok: false,
            field: 'name',
            errorKey: 'templateNameRequired',
        })
    })

    it('requires at least one live Exercise, ignoring members not on this device', () => {
        expect(validateTemplate({ name: 'Push', exerciseUuids: ['not-here'], liveMemberCount: 0 })).toMatchObject({
            ok: false,
            field: 'exercises',
        })
    })

    it('keeps the whole selection, including members not on this device yet', () => {
        expect(validateTemplate({ name: ' Push ', exerciseUuids: ['a', 'not-here'], liveMemberCount: 1 })).toEqual({
            ok: true,
            name: 'Push',
            exerciseUuids: ['a', 'not-here'],
        })
    })
})
