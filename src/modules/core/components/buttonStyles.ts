import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontWeight } from '@/src/constants/Typography'
import type { ThemeType } from '@/src/constants/Colors'
import type { TextStyle, ViewStyle } from 'react-native'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'text'
export type ButtonSize = 'sm' | 'md'

export interface ButtonStyleInput {
    variant: ButtonVariant
    size: ButtonSize
    isIconOnly: boolean
    disabled: boolean
    isLoading: boolean
    theme: ThemeType
}

export interface ResolvedButtonStyle {
    /**
     * Style stack for the touchable container, in render order. The component appends
     * the user `style` prop and then the `disabledOverlay` (when `isDisabled`) so the
     * disabled opacity always wins over a caller's style — matching the original.
     */
    container: ViewStyle[]
    /** Applied after the user `style` prop when `isDisabled`; `undefined` otherwise. */
    disabledOverlay: ViewStyle | undefined
    /** Style stack for the label text (user `labelStyle` prop is appended by the component). */
    label: TextStyle[]
    /** Variant label color, used to tint the icon and the loading spinner. */
    variantColor: string
    /** Glyph size for the optional left icon. */
    iconSize: number
    /** Whether the button is non-interactive (disabled or loading). */
    isDisabled: boolean
}

/**
 * Static, theme-independent style fragments. Plain objects (not `StyleSheet.create`)
 * so this module stays free of the react-native runtime and can be unit-tested as a
 * pure function. Values are identical to the originals in `Button.tsx`.
 */
export const buttonBaseStyles = {
    baseButton: {
        flexDirection: 'row',
        padding: Spacing.md,
        borderRadius: Radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        borderWidth: 1,
        borderColor: 'transparent',
        minHeight: 44,
    },
    sizeSm: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        minHeight: undefined,
    },
    iconOnly: {
        padding: Spacing.sm,
        borderRadius: Radius.sm,
    },
    outlineButton: {
        backgroundColor: 'transparent',
    },
    dangerButton: {},
    textButton: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
        minHeight: undefined,
        paddingVertical: 0,
        paddingHorizontal: 0,
    },
    primaryButtonText: {
        fontWeight: FontWeight.bold,
    },
    secondaryButtonText: {
        fontWeight: FontWeight.semibold,
    },
    outlineButtonText: {
        fontWeight: FontWeight.bold,
    },
    textButtonText: {
        fontWeight: FontWeight.semibold,
    },
    disabled: {
        opacity: 0.5,
    },
} satisfies Record<string, ViewStyle | TextStyle>

const resolveVariantContainer = (variant: ButtonVariant, theme: ThemeType): ViewStyle[] => {
    switch (variant) {
        case 'secondary':
            return [{ backgroundColor: theme.inputBackground, borderColor: theme.border }]
        case 'outline':
            return [buttonBaseStyles.outlineButton, { borderColor: theme.primary }]
        case 'danger':
            return [buttonBaseStyles.dangerButton, { backgroundColor: theme.error, borderColor: theme.border }]
        case 'text':
            return [buttonBaseStyles.textButton]
        default:
            return [{ backgroundColor: theme.primary, borderColor: theme.hairline }]
    }
}

const resolveVariantLabel = (variant: ButtonVariant, theme: ThemeType): TextStyle[] => {
    switch (variant) {
        case 'outline':
            return [buttonBaseStyles.outlineButtonText, { color: theme.primary }]
        case 'secondary':
            return [buttonBaseStyles.secondaryButtonText, { color: theme.text }]
        case 'text':
            return [buttonBaseStyles.textButtonText, { color: theme.primary }]
        default:
            return [buttonBaseStyles.primaryButtonText, { color: theme.onPrimary }]
    }
}

/**
 * Pure resolver mapping (variant, size, state) -> the style stacks the Button renders.
 * Preserves the exact style ordering and values of the original component.
 */
export const resolveButtonStyle = ({
    variant,
    size,
    isIconOnly,
    disabled,
    isLoading,
    theme,
}: ButtonStyleInput): ResolvedButtonStyle => {
    const isDisabled = disabled || isLoading

    const container: ViewStyle[] = [buttonBaseStyles.baseButton, ...resolveVariantContainer(variant, theme)]
    if (size === 'sm') container.push(buttonBaseStyles.sizeSm)
    if (isIconOnly) container.push(buttonBaseStyles.iconOnly)

    const label = resolveVariantLabel(variant, theme)
    const variantColor = (label[1] as { color: string })?.color ?? theme.onPrimary

    return {
        container,
        disabledOverlay: isDisabled ? buttonBaseStyles.disabled : undefined,
        label,
        variantColor,
        iconSize: size === 'sm' ? 14 : 16,
        isDisabled,
    }
}
