import { describe, expect, it } from 'vitest'
import { Colors } from '@/src/constants/Colors'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontWeight } from '@/src/constants/Typography'
import { type ButtonStyleInput, buttonBaseStyles, resolveButtonStyle } from '../buttonStyles'

const theme = Colors.dark

const resolve = (overrides: Partial<ButtonStyleInput>) =>
    resolveButtonStyle({
        variant: 'primary',
        size: 'md',
        isIconOnly: false,
        disabled: false,
        isLoading: false,
        theme,
        ...overrides,
    })

describe('resolveButtonStyle - container variant matrix', () => {
    it('primary uses theme.primary background and hairline border', () => {
        expect(resolve({ variant: 'primary' }).container).toEqual([
            buttonBaseStyles.baseButton,
            { backgroundColor: theme.primary, borderColor: theme.hairline },
        ])
    })

    it('secondary uses inputBackground and border', () => {
        expect(resolve({ variant: 'secondary' }).container).toEqual([
            buttonBaseStyles.baseButton,
            { backgroundColor: theme.inputBackground, borderColor: theme.border },
        ])
    })

    it('outline uses transparent background and primary border', () => {
        expect(resolve({ variant: 'outline' }).container).toEqual([
            buttonBaseStyles.baseButton,
            buttonBaseStyles.outlineButton,
            { borderColor: theme.primary },
        ])
    })

    it('danger uses error background and border', () => {
        expect(resolve({ variant: 'danger' }).container).toEqual([
            buttonBaseStyles.baseButton,
            buttonBaseStyles.dangerButton,
            { backgroundColor: theme.error, borderColor: theme.border },
        ])
    })

    it('text uses the textButton style', () => {
        expect(resolve({ variant: 'text' }).container).toEqual([
            buttonBaseStyles.baseButton,
            buttonBaseStyles.textButton,
        ])
    })
})

describe('resolveButtonStyle - size and shape modifiers', () => {
    it('md non-icon button has no sizeSm or iconOnly modifiers', () => {
        const { container } = resolve({ size: 'md', isIconOnly: false })
        expect(container).not.toContain(buttonBaseStyles.sizeSm)
        expect(container).not.toContain(buttonBaseStyles.iconOnly)
    })

    it('sm size appends sizeSm modifier', () => {
        expect(resolve({ size: 'sm' }).container).toContain(buttonBaseStyles.sizeSm)
    })

    it('icon-only appends iconOnly modifier', () => {
        expect(resolve({ isIconOnly: true }).container).toContain(buttonBaseStyles.iconOnly)
    })

    it('disabled exposes the disabled overlay (applied after user style)', () => {
        expect(resolve({ disabled: true }).disabledOverlay).toBe(buttonBaseStyles.disabled)
    })

    it('loading exposes the disabled overlay', () => {
        expect(resolve({ isLoading: true }).disabledOverlay).toBe(buttonBaseStyles.disabled)
    })

    it('neither disabled nor loading leaves the overlay undefined', () => {
        expect(resolve({ disabled: false, isLoading: false }).disabledOverlay).toBeUndefined()
    })

    it('the disabled overlay is never part of the base container stack', () => {
        expect(resolve({ disabled: true }).container).not.toContain(buttonBaseStyles.disabled)
    })
})

describe('resolveButtonStyle - label variant matrix', () => {
    it('outline label uses bold weight and primary color', () => {
        expect(resolve({ variant: 'outline' }).label).toEqual([
            buttonBaseStyles.outlineButtonText,
            { color: theme.primary },
        ])
    })

    it('secondary label uses semibold weight and text color', () => {
        expect(resolve({ variant: 'secondary' }).label).toEqual([
            buttonBaseStyles.secondaryButtonText,
            { color: theme.text },
        ])
    })

    it('text label uses semibold weight and primary color', () => {
        expect(resolve({ variant: 'text' }).label).toEqual([buttonBaseStyles.textButtonText, { color: theme.primary }])
    })

    it('primary label uses bold weight and onPrimary color', () => {
        expect(resolve({ variant: 'primary' }).label).toEqual([
            buttonBaseStyles.primaryButtonText,
            { color: theme.onPrimary },
        ])
    })

    it('danger label falls back to the primary label style', () => {
        expect(resolve({ variant: 'danger' }).label).toEqual([
            buttonBaseStyles.primaryButtonText,
            { color: theme.onPrimary },
        ])
    })
})

describe('resolveButtonStyle - variantColor', () => {
    it('exposes the variant label color for icon/spinner tinting', () => {
        expect(resolve({ variant: 'outline' }).variantColor).toBe(theme.primary)
        expect(resolve({ variant: 'secondary' }).variantColor).toBe(theme.text)
        expect(resolve({ variant: 'text' }).variantColor).toBe(theme.primary)
        expect(resolve({ variant: 'primary' }).variantColor).toBe(theme.onPrimary)
        expect(resolve({ variant: 'danger' }).variantColor).toBe(theme.onPrimary)
    })
})

describe('resolveButtonStyle - iconSize', () => {
    it('is 14 for sm and 16 for md', () => {
        expect(resolve({ size: 'sm' }).iconSize).toBe(14)
        expect(resolve({ size: 'md' }).iconSize).toBe(16)
    })
})

describe('resolveButtonStyle - isDisabled', () => {
    it('is true when disabled or loading, false otherwise', () => {
        expect(resolve({ disabled: true }).isDisabled).toBe(true)
        expect(resolve({ isLoading: true }).isDisabled).toBe(true)
        expect(resolve({ disabled: false, isLoading: false }).isDisabled).toBe(false)
    })
})

describe('buttonBaseStyles - static values unchanged', () => {
    it('baseButton matches the original layout', () => {
        expect(buttonBaseStyles.baseButton).toEqual({
            flexDirection: 'row',
            padding: Spacing.md,
            borderRadius: Radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.sm,
            borderWidth: 1,
            borderColor: 'transparent',
            minHeight: 44,
        })
    })

    it('sizeSm matches the original compact padding', () => {
        expect(buttonBaseStyles.sizeSm).toEqual({
            paddingVertical: 6,
            paddingHorizontal: 12,
            minHeight: undefined,
        })
    })

    it('textButton matches the original stripped style', () => {
        expect(buttonBaseStyles.textButton).toEqual({
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0,
            minHeight: undefined,
            paddingVertical: 0,
            paddingHorizontal: 0,
        })
    })

    it('label weight tokens match the originals', () => {
        expect(buttonBaseStyles.primaryButtonText).toEqual({ fontWeight: FontWeight.bold })
        expect(buttonBaseStyles.secondaryButtonText).toEqual({ fontWeight: FontWeight.semibold })
        expect(buttonBaseStyles.outlineButtonText).toEqual({ fontWeight: FontWeight.bold })
        expect(buttonBaseStyles.textButtonText).toEqual({ fontWeight: FontWeight.semibold })
        expect(buttonBaseStyles.disabled).toEqual({ opacity: 0.5 })
    })
})
