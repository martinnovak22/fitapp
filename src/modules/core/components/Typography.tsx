import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

interface TextProps {
    children: React.ReactNode;
    style?: StyleProp<TextStyle>;
    numberOfLines?: number;
}

export const Typography = {
    Title: ({ children, style, numberOfLines }: TextProps) => (
        <Text style={[GlobalStyles.title, style]} numberOfLines={numberOfLines}>
            {children}
        </Text>
    ),
    Subtitle: ({ children, style, numberOfLines }: TextProps) => (
        <Text style={[GlobalStyles.subtitle, { color: Theme.text }, style]} numberOfLines={numberOfLines}>
            {children}
        </Text>
    ),
    Label: ({ children, style, numberOfLines }: TextProps) => (
        <Text
            style={[
                {
                    color: Theme.textSecondary,
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: '500'
                },
                style
            ]}
            numberOfLines={numberOfLines}
        >
            {children}
        </Text>
    ),
    Meta: ({ children, style, numberOfLines }: TextProps) => (
        <Text
            style={[
                {
                    color: Theme.textSecondary,
                    fontSize: 12
                },
                style
            ]}
            numberOfLines={numberOfLines}
        >
            {children}
        </Text>
    ),
    Body: ({ children, style, numberOfLines }: TextProps) => (
        <Text style={[GlobalStyles.text, style]} numberOfLines={numberOfLines}>
            {children}
        </Text>
    ),
};
