import { Stack } from 'expo-router';

export default function HistoryLayout() {
    return (
        <Stack screenOptions={{
            headerShown: false
        }}>
            <Stack.Screen name="index" options={{ title: 'History' }} />
            <Stack.Screen name="[id]" options={{ headerShown: false }} />
        </Stack>
    );
}


