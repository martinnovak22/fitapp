import { Spacing } from '@/src/constants/Spacing';
import { GlobalStyles } from '@/src/constants/Styles';
import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface TextProps {
    children: React.ReactNode;
    style?: StyleProp<TextStyle>;
    numberOfLines?: number;
}

export const Typography = {
    Title: ({ children, style, numberOfLines }: TextProps) => {
        const { theme } = useTheme();
        return (
            <Text style={[GlobalStyles.title, { color: theme.text }, style]} numberOfLines={numberOfLines}>
                {children}
            </Text>
        );
    },
    Subtitle: ({ children, style, numberOfLines }: TextProps) => {
        const { theme } = useTheme();
        return (
            <Text style={[GlobalStyles.subtitle, { color: theme.text }, style]} numberOfLines={numberOfLines}>
                {children}
            </Text>
        );
    },
    Label: ({ children, style, numberOfLines }: TextProps) => {
        const { theme } = useTheme();
        return (
            <Text
                style={[
                    {
                        color: theme.textSecondary,
                        marginBottom: Spacing.sm,
                        fontSize: 14,
                        fontWeight: '500'
                    },
                    style
                ]}
                numberOfLines={numberOfLines}
            >
                {children}
            </Text>
        );
    },
    Meta: ({ children, style, numberOfLines }: TextProps) => {
        const { theme } = useTheme();
        return (
            <Text
                style={[
                    {
                        color: theme.textSecondary,
                        fontSize: 12
                    },
                    style
                ]}
                numberOfLines={numberOfLines}
            >
                {children}
            </Text>
        );
    },
    Body: ({ children, style, numberOfLines }: TextProps) => {
        const { theme } = useTheme();
        return (
            <Text style={[GlobalStyles.text, { color: theme.text }, style]} numberOfLines={numberOfLines}>
                {children}
            </Text>
        );
    },
};
