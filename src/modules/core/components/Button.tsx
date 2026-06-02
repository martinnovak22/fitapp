import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontWeight } from '@/src/constants/Typography'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import React from 'react'
import { ActivityIndicator, StyleProp, StyleSheet, TextStyle, TouchableOpacity, ViewStyle } from 'react-native'
import { Typography } from './Typography'
import { useTheme } from '../hooks/useTheme'

type GlyphName = keyof typeof FontAwesome.glyphMap

interface BaseButtonProps {
    onPress: () => void
    variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'text'
    size?: 'sm' | 'md'
    isLoading?: boolean
    disabled?: boolean
    style?: StyleProp<ViewStyle>
    labelStyle?: StyleProp<TextStyle>
    accessibilityHint?: string
    testID?: string
}

// Union enforces a11y: icon-only (no label) REQUIRES accessibilityLabel at compile time.
type ButtonProps = BaseButtonProps &
    (
        | { label: string; leftIcon?: GlyphName; accessibilityLabel?: string }
        | { label?: undefined; leftIcon: GlyphName; accessibilityLabel: string }
    )

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 }

export const Button: React.FC<ButtonProps> = ({
    label,
    leftIcon,
    onPress,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled = false,
    style,
    labelStyle,
    accessibilityLabel,
    accessibilityHint,
    testID,
}) => {
    const { theme } = useTheme()

    const isIconOnly = label === undefined

    const getButtonStyle = () => {
        switch (variant) {
            case 'secondary':
                return [{ backgroundColor: theme.inputBackground, borderColor: theme.border }]
            case 'outline':
                return [styles.outlineButton, { borderColor: theme.primary }]
            case 'danger':
                return [styles.dangerButton, { backgroundColor: theme.error, borderColor: theme.border }]
            case 'text':
                return [styles.textButton]
            default:
                return [{ backgroundColor: theme.primary, borderColor: theme.hairline }]
        }
    }

    const getLabelStyle = () => {
        switch (variant) {
            case 'outline':
                return [styles.outlineButtonText, { color: theme.primary }]
            case 'secondary':
                return [styles.secondaryButtonText, { color: theme.text }]
            case 'text':
                return [styles.textButtonText, { color: theme.primary }]
            default:
                return [styles.primaryButtonText, { color: theme.onPrimary }]
        }
    }
    const labelStyles = getLabelStyle()

    // Resolve the effective label/icon color: variant default, overridden by labelStyle.
    const variantColor = (labelStyles[1] as { color: string })?.color ?? theme.onPrimary
    const overrideColor = (StyleSheet.flatten(labelStyle) as TextStyle | undefined)?.color
    const resolvedColor = (overrideColor as string) ?? variantColor

    const iconSize = size === 'sm' ? 14 : 16

    return (
        <TouchableOpacity
            style={[
                styles.baseButton,
                getButtonStyle(),
                size === 'sm' && styles.sizeSm,
                isIconOnly && styles.iconOnly,
                style,
                (disabled || isLoading) && styles.disabled,
            ]}
            hitSlop={size === 'sm' || isIconOnly ? HIT_SLOP : undefined}
            onPress={onPress}
            disabled={disabled || isLoading}
            activeOpacity={0.7}
            accessibilityRole={'button'}
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ disabled: disabled || isLoading, busy: isLoading }}
            testID={testID}
        >
            {isLoading ? (
                <ActivityIndicator color={resolvedColor} />
            ) : (
                <>
                    {leftIcon && <FontAwesome name={leftIcon} size={iconSize} color={resolvedColor} />}
                    {label !== undefined && (
                        <Typography.Body size={size === 'sm' ? 'sm' : undefined} style={[labelStyles, labelStyle]}>
                            {label}
                        </Typography.Body>
                    )}
                </>
            )}
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
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
})
