import { Stack } from 'expo-router';

export default function WorkoutLayout() {
    return (
        <Stack screenOptions={{
            headerShown: false,

        }}>
            <Stack.Screen name="index" options={{ title: 'Workout' }} />
            <Stack.Screen name="[id]" options={{ title: 'Session' }} />
        </Stack>
    );
}
