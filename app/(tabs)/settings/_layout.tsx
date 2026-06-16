import { Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'

export { ErrorBoundary } from '@/src/modules/core/components/ErrorBoundary'

export default function SettingsLayout() {
    const { t } = useTranslation()
    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="index" options={{ title: t('settings') }} />
        </Stack>
    )
}
