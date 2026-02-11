import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function ExercisesLayout() {
    const { t } = useTranslation();
    return (
        <Stack screenOptions={{
            headerShown: false,
        }}>
            <Stack.Screen name="index" options={{ title: t('exercises') }} />
            <Stack.Screen name="add" options={{ title: t('newExercise') }} />
            <Stack.Screen name="edit/[id]" options={{ title: t('editExercise') }} />
            <Stack.Screen name="[id]" options={{ title: t('details') }} />
        </Stack>
    );
}
