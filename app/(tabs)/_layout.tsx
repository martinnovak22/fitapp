import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

function TabBarIcon(props: {
    name: React.ComponentProps<typeof FontAwesome>['name'];
    color: string;
}) {
    return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

import { useTheme } from '@/src/modules/core/hooks/useTheme';
import { TouchableOpacity } from 'react-native';

export default function TabLayout() {
    const { t } = useTranslation();
    const { theme } = useTheme();

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
                    headerRight: () => (
                        <TouchableOpacity
                            onPress={() => router.push('/settings')}
                            style={{ marginRight: 16 }}
                        >
                            <FontAwesome name="cog" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    )
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
        </Tabs>
    );
}
