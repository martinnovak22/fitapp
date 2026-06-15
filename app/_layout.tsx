import FontAwesome from '@expo/vector-icons/FontAwesome'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { PortalHost, PortalProvider } from 'react-native-teleport'
import Toast from 'react-native-toast-message'
import { FontWeight } from '@/src/constants/Typography'
import { initializeDataLayer } from '@/src/data/bootstrap'
import { SyncProvider } from '@/src/data/sync/SyncProvider'
import { SyncStatusBanner } from '@/src/data/sync/SyncStatusBanner'
import { log } from '@/src/modules/core/utils/logger'
import { useDatabaseInit } from '@/src/db/client'
import { AuthProvider, useAuth } from '@/src/modules/auth/useAuth'
import { toastConfig } from '@/src/modules/core/components/ToastConfig'
import { TimerPill } from '@/src/modules/timer/components/TimerPill'
import { TimerProvider } from '@/src/modules/timer/TimerProvider'
import { ThemeProvider as CustomThemeProvider, useTheme } from '../src/modules/core/hooks/useTheme'
import '../src/modules/core/utils/i18n'

export {
    // Catch any errors thrown by the Layout component.
    ErrorBoundary,
} from 'expo-router'

export const unstable_settings = {
    initialRouteName: '(tabs)',
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()
initializeDataLayer()

export default function RootLayout() {
    const [fontsLoaded, fontError] = useFonts({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
        ...FontAwesome.font,
    })

    const { dbLoaded, error: dbError } = useDatabaseInit()

    useEffect(() => {
        if (fontError) throw fontError
        if (dbError) log('error', 'DB Init Error', dbError)
    }, [fontError, dbError])

    if (!fontsLoaded || !dbLoaded) {
        return null
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <PortalProvider>
                <CustomThemeProvider>
                    <AuthProvider>
                        <TimerProvider>
                            <SyncProvider>
                                <SyncStatusBanner />
                                <RootLayoutNav />
                                <TimerPill />
                            </SyncProvider>
                        </TimerProvider>
                    </AuthProvider>
                </CustomThemeProvider>
                <PortalHost style={StyleSheet.absoluteFillObject} name="overlay" />
            </PortalProvider>
        </GestureHandlerRootView>
    )
}

function RootLayoutNav() {
    const { theme, isDark } = useTheme()
    const { isInitialized } = useAuth()

    useEffect(() => {
        if (isInitialized) {
            SplashScreen.hideAsync()
        }
    }, [isInitialized])

    if (!isInitialized) {
        return null
    }

    return (
        <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
            <Stack
                screenOptions={{
                    headerStyle: {
                        backgroundColor: theme.background,
                    },
                    headerTintColor: theme.text,
                    headerTitleStyle: {
                        fontWeight: FontWeight.bold,
                    },
                    contentStyle: {
                        backgroundColor: theme.background,
                    },
                }}
            >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="landing" options={{ headerShown: false, animation: 'fade' }} />
                <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
            </Stack>
            <Toast config={toastConfig} />
        </ThemeProvider>
    )
}
