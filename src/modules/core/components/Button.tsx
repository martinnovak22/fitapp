import { Spacing } from '@/src/constants/Spacing';
import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface ButtonProps {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'danger';
    isLoading?: boolean;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    labelStyle?: StyleProp<TextStyle>;
}

export const Button: React.FC<ButtonProps> = ({
    label,
    onPress,
    variant = 'primary',
    isLoading = false,
    disabled = false,
    style,
    labelStyle,
}) => {
    const { theme, isDark } = useTheme();

    const getButtonStyle = () => {
        switch (variant) {
            case 'secondary':
                return [styles.secondaryButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }];
            case 'outline':
                return [styles.outlineButton, { borderColor: theme.primary }];
            case 'danger':
                return styles.dangerButton;
            default:
                return [styles.primaryButton, { backgroundColor: theme.primary }];
        }
    };

    const getLabelStyle = () => {
        switch (variant) {
            case 'outline':
                return [styles.outlineButtonText, { color: theme.primary }];
            case 'secondary':
                return [styles.secondaryButtonText, { color: theme.text }];
            default:
                return styles.primaryButtonText;
        }
    };

    return (
        <TouchableOpacity
            style={[styles.baseButton, getButtonStyle(), style, (disabled || isLoading) && styles.disabled]}
            onPress={onPress}
            disabled={disabled || isLoading}
            activeOpacity={0.7}
        >
            {isLoading ? (
                <ActivityIndicator color={"white"} />
            ) : (
                <Text style={[getLabelStyle(), labelStyle]}>{label}</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    baseButton: {
        padding: Spacing.md,
        borderRadius: Spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    primaryButton: {
        borderColor: 'rgba(255,255,255,0.08)',
    },
    secondaryButton: {
        borderColor: 'rgba(255,255,255,0.1)',
    },
    outlineButton: {
        backgroundColor: 'transparent',
    },
    dangerButton: {
        backgroundColor: '#FF6B6B',
        borderColor: 'rgba(255,255,255,0.08)',
    },
    primaryButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    secondaryButtonText: {
        fontWeight: '600',
    },
    outlineButtonText: {
        fontWeight: 'bold',
    },
    disabled: {
        opacity: 0.5,
    },
});
