import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useDatabaseInit } from '../src/db/client';
import { ExerciseRepository } from '../src/db/exercises';
import { toastConfig } from '../src/modules/core/components/ToastConfig';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const { dbLoaded, error: dbError } = useDatabaseInit();

  useEffect(() => {
    if (fontError) throw fontError;
    if (dbError) console.error("DB Init Error: ", dbError);
  }, [fontError, dbError]);

  useEffect(() => {
    async function initializeApp() {
      if (fontsLoaded && dbLoaded) {
        try {
          await ExerciseRepository.seedDefaults();
        } catch (e) {
          console.error("Seeding Error: ", e);
        } finally {
          SplashScreen.hideAsync();
        }
      }
    }
    initializeApp();
  }, [fontsLoaded, dbLoaded]);

  if (!fontsLoaded || !dbLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootLayoutNav />
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  return (
    <ThemeProvider value={DarkTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <Toast config={toastConfig} />
    </ThemeProvider>
  );
}
