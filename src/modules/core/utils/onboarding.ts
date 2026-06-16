import AsyncStorage from '@react-native-async-storage/async-storage'

const ONBOARDING_KEY = 'onboarding_completed'

export const isOnboardingCompleted = async (): Promise<boolean> => {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY)
    return value === 'true'
}

export const markOnboardingCompleted = async (): Promise<void> => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
}
