import FontAwesome from '@expo/vector-icons/FontAwesome'
import type React from 'react'
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import { useTheme } from '../hooks/useTheme'
import { Typography } from './Typography'

interface EmptyStateProps {
    message: string
    subMessage?: string
    icon?: keyof typeof FontAwesome.glyphMap
    style?: StyleProp<ViewStyle>
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message, subMessage, icon, style }) => {
    const { theme } = useTheme()

    return (
        <View style={[styles.container, style]}>
            {icon && <FontAwesome name={icon} size={Spacing.lg} color={theme.textSecondary} />}
            <Typography.Body weight="medium" color="textSecondary" style={styles.message}>
                {message}
            </Typography.Body>
            {subMessage && (
                <Typography.Meta color="textSecondary" style={styles.subMessage}>
                    {subMessage}
                </Typography.Meta>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        padding: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    message: {
        textAlign: 'center',
    },
    subMessage: {
        textAlign: 'center',
    },
})
