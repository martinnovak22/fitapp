import { GlobalStyles } from '@/src/constants/Styles';
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface ScreenLayoutProps {
    children: React.ReactNode;
    style?: ViewStyle;
}

export const ScreenLayout = ({ children, style }: ScreenLayoutProps) => {
    const { theme } = useTheme();
    return (
        <View style={[GlobalStyles.container, { backgroundColor: theme.background }, style]}>
            {children}
        </View>
    );
};
