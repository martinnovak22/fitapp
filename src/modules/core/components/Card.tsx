import { GlobalStyles } from '@/src/constants/Styles';
import React from 'react';
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';

interface CardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
    activeOpacity?: number;
}

export const Card: React.FC<CardProps> = ({ children, style, onPress, activeOpacity = 0.7 }) => {
    if (onPress) {
        return (
            <TouchableOpacity
                style={[GlobalStyles.card, style]}
                onPress={onPress}
                activeOpacity={activeOpacity}
            >
                {children}
            </TouchableOpacity>
        );
    }

    return (
        <View style={[GlobalStyles.card, style]}>
            {children}
        </View>
    );
};
