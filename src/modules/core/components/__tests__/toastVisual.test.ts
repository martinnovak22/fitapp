import { describe, expect, it } from 'vitest'
import { resolveToastVisual } from '../toastVisual'

const palette = { primary: '#1', error: '#e', info: '#i' }

describe('resolveToastVisual', () => {
    it('maps success to a check icon tinted with the primary color and no action support', () => {
        expect(resolveToastVisual({ type: 'success' }, palette)).toEqual({
            icon: 'check-circle',
            iconColor: '#1',
            actionColor: undefined,
            supportsAction: false,
        })
    })

    it('maps danger to an info icon tinted with the error color and no action support', () => {
        expect(resolveToastVisual({ type: 'danger' }, palette)).toEqual({
            icon: 'info-circle',
            iconColor: '#e',
            actionColor: undefined,
            supportsAction: false,
        })
    })

    it('maps info to the info color for both icon and action, and supports an action', () => {
        expect(resolveToastVisual({ type: 'info' }, palette)).toEqual({
            icon: 'info-circle',
            iconColor: '#i',
            actionColor: '#i',
            supportsAction: true,
        })
    })

    it('lets an explicit icon override the per-type default', () => {
        expect(resolveToastVisual({ type: 'success', icon: 'star' }, palette).icon).toBe('star')
        expect(resolveToastVisual({ type: 'info', icon: 'star' }, palette).icon).toBe('star')
    })
})
