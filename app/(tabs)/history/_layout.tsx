import { Theme } from '@/src/constants/Colors';
import { Stack } from 'expo-router';

export default function HistoryLayout() {
    return (
        <Stack screenOptions={{
            headerStyle: {
                backgroundColor: Theme.background,
            },
            headerTintColor: Theme.tint,
            headerTitleStyle: {
                color: Theme.text,
            },
            contentStyle: {
                backgroundColor: Theme.background,
            },
            headerShown: false
        }}>
            <Stack.Screen name="index" options={{ title: 'History' }} />
            <Stack.Screen name="[id]" options={{ headerShown: false }} />
        </Stack>
    );
}


