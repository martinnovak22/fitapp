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
            supportsCancel: false,
        })
    })

    it('maps danger to an info icon tinted with the error color and no action support', () => {
        expect(resolveToastVisual({ type: 'danger' }, palette)).toEqual({
            icon: 'info-circle',
            iconColor: '#e',
            actionColor: undefined,
            supportsAction: false,
            supportsCancel: false,
        })
    })

    it('maps info to the info color for both icon and action, and supports an action', () => {
        expect(resolveToastVisual({ type: 'info' }, palette)).toEqual({
            icon: 'info-circle',
            iconColor: '#i',
            actionColor: '#i',
            supportsAction: true,
            supportsCancel: false,
        })
    })

    it('maps a non-danger confirm to the info color and supports action plus cancel', () => {
        expect(resolveToastVisual({ type: 'confirm' }, palette)).toEqual({
            icon: 'info-circle',
            iconColor: '#i',
            actionColor: '#i',
            supportsAction: true,
            supportsCancel: true,
        })
    })

    it('maps a danger confirm to a trash icon tinted with the error color', () => {
        expect(resolveToastVisual({ type: 'confirm', tone: 'danger' }, palette)).toEqual({
            icon: 'trash',
            iconColor: '#e',
            actionColor: '#e',
            supportsAction: true,
            supportsCancel: true,
        })
    })

    it('lets an explicit icon override the per-type default', () => {
        expect(resolveToastVisual({ type: 'success', icon: 'star' }, palette).icon).toBe('star')
        expect(resolveToastVisual({ type: 'confirm', tone: 'danger', icon: 'star' }, palette).icon).toBe('star')
    })
})
