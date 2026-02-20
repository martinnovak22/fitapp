import { Redirect } from 'expo-router'
import { useAuth } from '@/src/modules/auth/useAuth'

export default function Index() {
    const { isAuthRequired, isAuthenticated, isInitialized } = useAuth()

    if (isAuthRequired) {
        if (!isInitialized) return null
        if (!isAuthenticated) return <Redirect href={'./login'} />
    }

    return <Redirect href={'/landing'} />
}
