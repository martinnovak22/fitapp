import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';

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
    const getButtonStyle = () => {
        switch (variant) {
            case 'secondary':
                return styles.secondaryButton;
            case 'outline':
                return styles.outlineButton;
            case 'danger':
                return styles.dangerButton;
            default:
                return styles.primaryButton;
        }
    };

    const getLabelStyle = () => {
        switch (variant) {
            case 'outline':
                return styles.outlineButtonText;
            case 'secondary':
                return styles.secondaryButtonText;
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
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    primaryButton: {
        backgroundColor: Theme.primary,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    secondaryButton: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    outlineButton: {
        backgroundColor: 'transparent',
        borderColor: Theme.primary,
    },
    dangerButton: {
        backgroundColor: '#FF6B6B',
        borderColor: 'rgba(255,255,255,0.08)',
    },
    primaryButtonText: {
        ...GlobalStyles.text,
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    secondaryButtonText: {
        ...GlobalStyles.text,
        color: Theme.text,
        fontWeight: '600',
    },
    outlineButtonText: {
        ...GlobalStyles.text,
        color: Theme.primary,
        fontWeight: 'bold',
    },
    disabled: {
        opacity: 0.5,
    },
});
