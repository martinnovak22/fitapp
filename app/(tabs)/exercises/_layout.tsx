import { Stack } from 'expo-router';

export default function ExercisesLayout() {
    return (
        <Stack screenOptions={{
            headerShown: false,
        }}>
            <Stack.Screen name="index" options={{ title: 'Exercises' }} />
            <Stack.Screen name="add" options={{ title: 'New Exercise' }} />
            <Stack.Screen name="[id]" options={{ title: 'Details' }} />
        </Stack>
    );
}
