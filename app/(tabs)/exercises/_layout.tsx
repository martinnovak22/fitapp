import { Theme } from '@/src/constants/Colors';
import { Stack } from 'expo-router';

export default function ExercisesLayout() {
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
            headerShown: false,
        }}>
            <Stack.Screen name="index" options={{ title: 'Exercises' }} />
            <Stack.Screen name="add" options={{ title: 'New Exercise' }} />
            <Stack.Screen name="[id]" options={{ title: 'Details' }} />
        </Stack>
    );
}
