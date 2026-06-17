import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Localization from 'expo-localization'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import cs from '@/src/locales/cs.json'
import en from '@/src/locales/en.json'
import { log } from '@/src/modules/core/utils/logger'

const resources = {
    en: { translation: en },
    cs: { translation: cs },
}

const LANGUAGE_KEY = 'user-language'

const languageDetector = {
    type: 'languageDetector' as const,
    async: true,
    detect: async (callback: (lang: string) => void) => {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY)
        if (savedLanguage) {
            return callback(savedLanguage)
        }
        const locales = Localization.getLocales()
        const deviceLanguage = locales && locales.length > 0 ? locales[0].languageCode : 'en'
        callback(deviceLanguage || 'en')
    },
    init: () => {},
    cacheUserLanguage: (language: string) => {
        // i18next never awaits this, so handle the rejection here rather than
        // letting a failed storage write become an unhandled promise rejection.
        AsyncStorage.setItem(LANGUAGE_KEY, language).catch((error) => log('error', 'cacheUserLanguage', error))
    },
}

// eslint-disable-next-line import/no-named-as-default-member
i18n.use(languageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
        react: {
            useSuspense: false,
        },
    })

export default i18n
