import FontAwesome from '@expo/vector-icons/FontAwesome'
import { Redirect, Tabs } from 'expo-router'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/src/modules/auth/useAuth'
import { useTheme } from '@/src/modules/core/hooks/useTheme'

export { ErrorBoundary } from '@/src/modules/core/components/ErrorBoundary'

const TAB_BAR_BASE_HEIGHT = 80

function TabBarIcon(props: { name: React.ComponentProps<typeof FontAwesome>['name']; color: string }) {
    return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />
}
export default function TabLayout() {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const insets = useSafeAreaInsets()
    const { isAuthRequired, isAuthenticated, isInitialized } = useAuth()

    // Declarative guard only — index.tsx is the primary gatekeeper; this is the
    // belt-and-braces redirect for direct/deep-linked navigation into a tab.
    if (isAuthRequired) {
        if (!isInitialized) return null
        if (!isAuthenticated) return <Redirect href={'/login'} />
    }

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: theme.primary,
                tabBarInactiveTintColor: theme.textSecondary,
                tabBarStyle: {
                    backgroundColor: theme.background,
                    borderTopColor: theme.border,
                    height: TAB_BAR_BASE_HEIGHT,
                    paddingTop: 10,
                    paddingBottom: insets.bottom,
                },
                headerTitleAlign: 'center',
                headerStyle: {
                    backgroundColor: theme.background,
                    borderBottomColor: theme.border,
                    borderBottomWidth: 0.25,
                },
                headerTintColor: theme.text,
            }}
        >
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
    )
}
