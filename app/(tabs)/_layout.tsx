import { Theme } from '@/src/constants/Colors';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import React from 'react';

function TabBarIcon(props: {
    name: React.ComponentProps<typeof FontAwesome>['name'];
    color: string;
}) {
    return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Theme.tint,
                tabBarStyle: {
                    backgroundColor: Theme.background,
                    borderTopColor: Theme.border,
                    height: 80,
                    paddingTop: 10,
                },
                headerTitleAlign: 'center',
                headerStyle: {
                    borderBottomColor: Theme.border,
                    borderBottomWidth: 0.25,
                }
            }}>
            <Tabs.Screen
                name="workout"
                options={{
                    title: 'Workout',
                    tabBarIcon: ({ color }) => <TabBarIcon name="heartbeat" color={color} />,
                }}
            />
            <Tabs.Screen
                name="exercises"
                options={{
                    title: 'Exercises',
                    tabBarIcon: ({ color }) => <TabBarIcon name="list" color={color} />,
                }}
            />
            <Tabs.Screen
                name="history"
                listeners={({ navigation }) => ({
                    tabPress: (e) => {
                        // Prevent default action
                        e.preventDefault();
                        // Navigate to the tab's root route
                        navigation.navigate('history', { screen: 'index' });
                    },
                })}
                options={{
                    title: 'History',
                    tabBarIcon: ({ color }) => <TabBarIcon name="history" color={color} />,
                }}
            />
        </Tabs>
    );
}
