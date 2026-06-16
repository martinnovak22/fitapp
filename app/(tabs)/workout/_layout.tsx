import { Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'

export { ErrorBoundary } from '@/src/modules/core/components/ErrorBoundary'

export default function WorkoutLayout() {
    const { t } = useTranslation()
    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="index" options={{ title: t('workout') }} />
            <Stack.Screen name="[id]" options={{ title: t('session') }} />
            <Stack.Screen name="calendar" options={{ title: t('calendar') }} />
        </Stack>
    )
}
