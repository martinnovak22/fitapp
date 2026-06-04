import FontAwesome from '@expo/vector-icons/FontAwesome'
import React from 'react'
import { ActivityIndicator, StyleProp, StyleSheet, TextStyle, TouchableOpacity, ViewStyle } from 'react-native'
import { type ButtonSize, type ButtonVariant, resolveButtonStyle } from './buttonStyles'
import { Typography } from './Typography'
import { useTheme } from '../hooks/useTheme'

type GlyphName = keyof typeof FontAwesome.glyphMap

interface BaseButtonProps {
    onPress: () => void
    variant?: ButtonVariant
    size?: ButtonSize
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

    const {
        container,
        disabledOverlay,
        label: labelStyles,
        variantColor,
        iconSize,
        isDisabled,
    } = resolveButtonStyle({ variant, size, isIconOnly, disabled, isLoading, theme })

    // Resolve the effective label/icon color: variant default, overridden by labelStyle.
    const overrideColor = (StyleSheet.flatten(labelStyle) as TextStyle | undefined)?.color
    const resolvedColor = (overrideColor as string) ?? variantColor

    return (
        <TouchableOpacity
            style={[container, style, disabledOverlay]}
            hitSlop={size === 'sm' || isIconOnly ? HIT_SLOP : undefined}
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.7}
            accessibilityRole={'button'}
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ disabled: isDisabled, busy: isLoading }}
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
