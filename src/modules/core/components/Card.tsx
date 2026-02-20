import { GlobalStyles } from '@/src/constants/Styles'
import React from 'react'
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native'
import { useTheme } from '../hooks/useTheme'

interface CardProps {
    children: React.ReactNode
    style?: StyleProp<ViewStyle>
    onPress?: () => void
    activeOpacity?: number
    accessibilityLabel?: string
    accessibilityHint?: string
}

export const Card: React.FC<CardProps> = ({
    children,
    style,
    onPress,
    activeOpacity = 0.7,
    accessibilityLabel,
    accessibilityHint,
}) => {
    const { theme } = useTheme()

    const cardStyle = [
        GlobalStyles.card,
        {
            backgroundColor: theme.card,
            borderColor: theme.border,
        },
        style,
    ]

    if (onPress) {
        return (
            <TouchableOpacity
                style={cardStyle}
                onPress={onPress}
                activeOpacity={activeOpacity}
                accessibilityLabel={accessibilityLabel}
                accessibilityHint={accessibilityHint}
            >
                {children}
            </TouchableOpacity>
        )
    }

    return <View style={cardStyle}>{children}</View>
}
