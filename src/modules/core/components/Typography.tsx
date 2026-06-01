import { FontSize, FontSizeToken, FontWeight, FontWeightToken } from '@/src/constants/Typography'
import React from 'react'
import { StyleProp, Text, TextStyle } from 'react-native'
import { ThemeType } from '@/src/constants/Colors'
import { useTheme } from '../hooks/useTheme'

type ColorToken = keyof Pick<ThemeType, 'text' | 'textSecondary' | 'primary' | 'secondary' | 'error' | 'onPrimary'>

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
}

interface VariantConfig {
    size: FontSizeToken
    weight: FontWeightToken
    color: ColorToken
}

const makeVariant = (config: VariantConfig) => {
    const Component = ({ children, style, numberOfLines, size, weight, color }: TextProps) => {
        const { theme } = useTheme()
        return (
            <Text
                style={[
                    {
                        fontSize: FontSize[size ?? config.size],
                        fontWeight: FontWeight[weight ?? config.weight],
                        color: theme[color ?? config.color],
                    },
                    style,
                ]}
                numberOfLines={numberOfLines}
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
