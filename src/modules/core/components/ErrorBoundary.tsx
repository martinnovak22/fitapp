import FontAwesome from '@expo/vector-icons/FontAwesome'
import { StyleSheet, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { useTheme } from '../hooks/useTheme'
import { Button } from './Button'
import { Typography } from './Typography'

interface ErrorBoundaryProps {
    error: Error
    retry: () => void
}

export const ErrorBoundary = ({ error, retry }: ErrorBoundaryProps) => {
    const { theme } = useTheme()

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.content}>
                <View style={[styles.iconContainer, { backgroundColor: theme.errorSurface }]}>
                    <FontAwesome name="exclamation-triangle" size={32} color="white" />
                </View>

                <Typography.Title style={styles.title}>Something went wrong</Typography.Title>

                <Typography.Body color="textSecondary" style={styles.message}>
                    {error.message || 'An unexpected error occurred.'}
                </Typography.Body>

                <Button label="Try again" onPress={retry} variant="primary" />
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    content: {
        alignItems: 'center',
        maxWidth: 320,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
    },
    title: {
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    message: {
        textAlign: 'center',
        marginBottom: Spacing.lg,
        lineHeight: 22,
    },
})
