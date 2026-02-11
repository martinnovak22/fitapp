import { Spacing } from '@/src/constants/Spacing';
import { GlobalStyles } from '@/src/constants/Styles';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface EmptyStateProps {
    message: string;
    subMessage?: string;
    icon?: keyof typeof FontAwesome.glyphMap;
    style?: StyleProp<ViewStyle>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    message,
    subMessage,
    icon,
    style
}) => {
    const { theme } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.surfaceSubtle, borderColor: theme.inputBackgroundActive }, style]}>
            {icon && (
                <FontAwesome
                    name={icon}
                    size={40}
                    color={theme.textSecondary}
                    style={styles.icon}
                />
            )}
            <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
            {subMessage && <Text style={[styles.subMessage, { color: theme.textSecondary }]}>{subMessage}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: Spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 1,
    },
    icon: {
        marginBottom: Spacing.md,
    },
    message: {
        ...GlobalStyles.text,
        textAlign: 'center',
        fontWeight: '500',
    },
    subMessage: {
        ...GlobalStyles.text,
        fontSize: 12,
        textAlign: 'center',
        marginTop: Spacing.xs,
        opacity: 0.7,
    },
});
