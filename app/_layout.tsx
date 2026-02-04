import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useDatabaseInit } from '../src/db/client';
import { toastConfig } from '../src/modules/core/components/ToastConfig';
import { ThemeProvider as CustomThemeProvider, useTheme } from '../src/modules/core/hooks/useTheme';
import '../src/modules/core/utils/i18n';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const { dbLoaded, error: dbError } = useDatabaseInit();

  useEffect(() => {
    if (fontError) throw fontError;
    if (dbError) console.error("DB Init Error: ", dbError);
    if (fontsLoaded && dbLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontError, dbError, fontsLoaded, dbLoaded]);

  if (!fontsLoaded || !dbLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <CustomThemeProvider>
        <RootLayoutNav />
      </CustomThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const { theme, isDark } = useTheme();

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.background,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: theme.background,
          }
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="landing" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings', presentation: 'modal' }} />
      </Stack>
      <Toast config={toastConfig} />
    </ThemeProvider>
  );
}
