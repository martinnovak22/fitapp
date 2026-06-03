import FontAwesome from '@expo/vector-icons/FontAwesome'
import type React from 'react'
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'
import { Radius } from '@/src/constants/Radius'
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
        <View
            style={[
                styles.container,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.inputBackgroundActive },
                style,
            ]}
        >
            {icon && <FontAwesome name={icon} size={Spacing.xl2} color={theme.textSecondary} style={styles.icon} />}
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
        padding: Spacing.xl2,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.md,
        borderStyle: 'dashed',
        borderWidth: 1,
    },
    icon: {
        marginBottom: Spacing.md,
    },
    message: {
        textAlign: 'center',
    },
    subMessage: {
        textAlign: 'center',
        marginTop: Spacing.xs,
        opacity: 0.7,
    },
})
