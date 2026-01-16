import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import React from 'react';
import { View, ViewStyle } from 'react-native';

interface ScreenLayoutProps {
    children: React.ReactNode;
    style?: ViewStyle;
}

export const ScreenLayout = ({ children, style }: ScreenLayoutProps) => {
    return (
        <View style={[GlobalStyles.container, { backgroundColor: Theme.background }, style]}>
            {children}
        </View>
    );
};
