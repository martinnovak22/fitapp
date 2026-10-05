import type React from 'react'
import { type AccessibilityRole, type StyleProp, Text, type TextStyle } from 'react-native'
import type { ThemeType } from '@/src/constants/Colors'
import { FontSize, type FontSizeToken, FontWeight, type FontWeightToken } from '@/src/constants/Typography'
import { useTheme } from '../hooks/useTheme'

type ColorToken = keyof Pick<ThemeType, 'text' | 'textSecondary' | 'primary' | 'error' | 'onPrimary'>

interface TextProps {
    children: React.ReactNode
    style?: StyleProp<TextStyle>
    numberOfLines?: number
    /** Override the variant's default size with a scale token. */
    size?: FontSizeToken
    /** Override the variant's default weight with a scale token. */
    weight?: FontWeightToken
    /** Override the variant's default color with a theme token. */
    color?: ColorToken
    /** Tabular nums: every digit gets the same width, so weights, reps and timers don't jitter as they change. */
    numeric?: boolean
    accessibilityRole?: AccessibilityRole
}

interface VariantConfig {
    size: FontSizeToken
    weight: FontWeightToken
    color: ColorToken
}

const NUMERIC_STYLE: TextStyle = { fontVariant: ['tabular-nums'] }

const makeVariant = (config: VariantConfig) => {
    const Component = ({
        children,
        style,
        numberOfLines,
        size,
        weight,
        color,
        numeric,
        accessibilityRole,
    }: TextProps) => {
        const { theme } = useTheme()
        return (
            <Text
                style={[
                    {
                        fontSize: FontSize[size ?? config.size],
                        fontWeight: FontWeight[weight ?? config.weight],
                        color: theme[color ?? config.color],
                    },
                    numeric && NUMERIC_STYLE,
                    style,
                ]}
                numberOfLines={numberOfLines}
                accessibilityRole={accessibilityRole}
            >
                {children}
            </Text>
        )
    }
    return Component
}

export const Typography = {
    Title: makeVariant({ size: 'xxl', weight: 'bold', color: 'text' }),
    Subtitle: makeVariant({ size: 'lg', weight: 'semibold', color: 'text' }),
    Label: makeVariant({ size: 'sm', weight: 'medium', color: 'textSecondary' }),
    Meta: makeVariant({ size: 'xs', weight: 'regular', color: 'textSecondary' }),
    Body: makeVariant({ size: 'md', weight: 'regular', color: 'text' }),
}
