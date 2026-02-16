import { useTheme } from '@/src/modules/core/hooks/useTheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/modules/auth/useAuth';

function TabBarIcon(props: {
    name: React.ComponentProps<typeof FontAwesome>['name'];
    color: string;
}) {
    return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}
export default function TabLayout() {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const { isAuthRequired, isAuthenticated, isInitialized } = useAuth();

    if (isAuthRequired) {
        if (!isInitialized) return null;
        if (!isAuthenticated) return <Redirect href={"../login"} />;
    }

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: theme.primary,
                tabBarInactiveTintColor: theme.textSecondary,
                tabBarStyle: {
                    backgroundColor: theme.background,
                    borderTopColor: theme.border,
                    height: 80,
                    paddingTop: 10,
                },
                headerTitleAlign: 'center',
                headerStyle: {
                    backgroundColor: theme.background,
                    borderBottomColor: theme.border,
                    borderBottomWidth: 0.25,
                },
                headerTintColor: theme.text,
            }}>
            <Tabs.Screen
                name="workout"
                options={{
                    title: t('workout'),
                    tabBarIcon: ({ color }) => <TabBarIcon name="heartbeat" color={color} />,
                }}
            />
            <Tabs.Screen
                name="exercises"
                options={{
                    title: t('exercises'),
                    tabBarIcon: ({ color }) => <TabBarIcon name="list" color={color} />,
                }}
            />
            <Tabs.Screen
                name="history"
                listeners={({ navigation }) => ({
                    tabPress: (e) => {
                        e.preventDefault();
                        navigation.navigate('history', { screen: 'index' });
                    },
                })}
                options={{
                    title: t('history'),
                    tabBarIcon: ({ color }) => <TabBarIcon name="history" color={color} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: t('settings'),
                    tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
                }}
            />
        </Tabs>
    );
}
