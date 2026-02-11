import { Spacing } from '@/src/constants/Spacing';
import { GlobalStyles } from '@/src/constants/Styles';
import { ComponentType, ReactElement, ReactNode } from 'react';
import { RefreshControlProps, ScrollView, ScrollViewProps, View, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface ScreenLayoutProps {
    children: ReactNode;
    style?: ViewStyle;
}

export const ScreenLayout = ({ children, style }: ScreenLayoutProps) => {
    const { theme } = useTheme();
    return (
        <View style={[GlobalStyles.container, { backgroundColor: theme.background, paddingTop: Spacing.md }, style]}>
            {children}
        </View>
    );
};

interface ScrollScreenLayoutProps extends Omit<ScrollViewProps, 'style' | 'contentContainerStyle' | 'refreshControl'> {
    children: ReactNode;
    style?: ViewStyle;
    refreshControl?: ReactElement<RefreshControlProps>;
    contentContainerStyle?: ViewStyle;
    ScrollComponent?: ComponentType<ScrollViewProps>;
    fixedHeader?: ReactNode;
    floatingElements?: ReactNode;
}

export const ScrollScreenLayout = ({ children, style, refreshControl, contentContainerStyle, ScrollComponent = ScrollView, fixedHeader, floatingElements, ...props }: ScrollScreenLayoutProps) => {
    const { theme } = useTheme();
    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            {
                fixedHeader && (
                    <View style={{ paddingHorizontal: Spacing.md }}>{fixedHeader}</View>
                )
            }
            <ScrollComponent
                style={{ flex: 1 }}
                contentContainerStyle={[
                    { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
                    contentContainerStyle
                ]}
                showsVerticalScrollIndicator={false}
                refreshControl={refreshControl}
                {...props}
            >
                <View style={style}>
                    {children}
                </View>
            </ScrollComponent>
            {floatingElements}
        </View>
    );
};
