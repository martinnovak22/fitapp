import Constants from 'expo-constants'
import { router } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Duration } from '@/src/constants/Motion'
import { Spacing } from '@/src/constants/Spacing'
import { useAuth } from '@/src/modules/auth/useAuth'
import { ListRow } from '@/src/modules/core/components/ListRow'
import { ListSection } from '@/src/modules/core/components/ListSection'
import { Appear } from '@/src/modules/core/components/motion'
import { ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { type Segment, SegmentedControl } from '@/src/modules/core/components/SegmentedControl'
import { SelectSheet } from '@/src/modules/core/components/SelectSheet'
import { Typography } from '@/src/modules/core/components/Typography'
import { type ThemeMode, useTheme } from '@/src/modules/core/hooks/useTheme'

export default function SettingsScreen() {
    const { t, i18n } = useTranslation()
    const { mode, setMode } = useTheme()
    const { authMode, isAuthRequired, userEmail, signOut } = useAuth()
    const [languageSheetVisible, setLanguageSheetVisible] = useState(false)
    const isGuestMode = authMode === 'guest'
    const appVersion = Constants.expoConfig?.version ?? 'dev'

    // Each language is named in itself, so it stays findable whatever the UI language is.
    const languages = [
        { value: 'en', label: 'English' },
        { value: 'cs', label: 'Čeština' },
    ]
    const currentLanguage = languages.find((lang) => i18n.language.startsWith(lang.value)) ?? languages[0]

    const themeSegments: Segment<ThemeMode>[] = [
        { value: 'system', label: t('themeSystem') },
        { value: 'light', label: t('themeLight') },
        { value: 'dark', label: t('themeDark') },
    ]

    return (
        <ScrollScreenLayout style={styles.content}>
            <Appear variant="down" durationMs={Duration.slow} style={styles.sections}>
                <ListSection title={t('general')}>
                    <ListRow
                        label={t('language')}
                        value={currentLanguage.label}
                        accessory={'chevron'}
                        onPress={() => setLanguageSheetVisible(true)}
                    />
                </ListSection>

                <View style={styles.group}>
                    <Typography.Label style={styles.groupTitle} accessibilityRole={'header'}>
                        {t('appearance')}
                    </Typography.Label>
                    <SegmentedControl
                        segments={themeSegments}
                        value={mode}
                        onChange={setMode}
                        accessibilityLabel={t('appearance')}
                    />
                </View>

                {(isAuthRequired || isGuestMode) &&
                    (isGuestMode ? (
                        <ListSection title={t('account')} footer={t('signInToEnableSync')}>
                            <ListRow
                                label={t('createAccount')}
                                leadingIcon={'user-plus'}
                                accessory={'chevron'}
                                onPress={() => router.push('../login?mode=signup')}
                            />
                        </ListSection>
                    ) : (
                        <ListSection title={t('account')}>
                            <ListRow label={t('loggedInAs')} value={userEmail ?? t('notSpecified')} />
                            {/* No explicit navigation: dropping the session flips isAuthenticated and the
                                tabs-layout guard redirects to login once — a second replace would remount
                                it and replay the entrance animations. */}
                            <ListRow label={t('signOut')} leadingIcon={'sign-out'} onPress={signOut} />
                        </ListSection>
                    ))}

                <Typography.Meta color={'textSecondary'} style={styles.version}>
                    {`FitApp ${appVersion}`}
                </Typography.Meta>
            </Appear>

            <SelectSheet
                visible={languageSheetVisible}
                onClose={() => setLanguageSheetVisible(false)}
                title={t('language')}
                mode={'single'}
                options={languages}
                value={currentLanguage.value}
                onSelect={(code) => i18n.changeLanguage(code)}
            />
        </ScrollScreenLayout>
    )
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: Spacing.lg,
    },
    sections: {
        gap: Spacing.lg,
    },
    group: {
        gap: Spacing.sm,
    },
    groupTitle: {
        paddingHorizontal: Spacing.md,
    },
    version: {
        textAlign: 'center',
    },
})
