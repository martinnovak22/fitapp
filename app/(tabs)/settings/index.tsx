import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontSize, FontWeight } from '@/src/constants/Typography'
import { Button } from '@/src/modules/core/components/Button'
import { Card } from '@/src/modules/core/components/Card'
import { ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { ThemeMode, useTheme } from '@/src/modules/core/hooks/useTheme'
import { isRemoteDataMode } from '@/src/modules/auth/authMode'
import { useAuth } from '@/src/modules/auth/useAuth'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import Constants from 'expo-constants'
import { router } from 'expo-router'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Duration } from '@/src/constants/Motion'
import { Appear } from '@/src/modules/core/components/motion'

export default function SettingsScreen() {
    const { t, i18n } = useTranslation()
    const { mode, setMode, theme } = useTheme()
    const { authMode, isAuthRequired, userEmail, signOut } = useAuth()
    const isGuestMode = isRemoteDataMode() && authMode === 'guest'
    const appVersion = Constants.expoConfig?.version ?? 'dev'

    const languages = [
        { code: 'en', label: t('english'), icon: '🇺🇸' },
        { code: 'cs', label: t('czech'), icon: '🇨🇿' },
    ]

    const themes: { mode: ThemeMode; label: string; icon: keyof typeof FontAwesome.glyphMap }[] = [
        { mode: 'light', label: t('lightMode'), icon: 'sun-o' },
        { mode: 'dark', label: t('darkMode'), icon: 'moon-o' },
        { mode: 'system', label: t('systemDefault'), icon: 'desktop' },
    ]

    return (
        <ScrollScreenLayout style={{ paddingBottom: Spacing.md }}>
            <Appear variant="down" durationMs={Duration.slow}>
                <Typography.Subtitle style={[styles.sectionTitle, { color: theme.primary }]}>
                    {t('language')}
                </Typography.Subtitle>
                <Card style={styles.card}>
                    {languages.map((lang, index) => (
                        <React.Fragment key={lang.code}>
                            <TouchableOpacity style={styles.settingItem} onPress={() => i18n.changeLanguage(lang.code)}>
                                <View style={styles.settingLeft}>
                                    <Typography.Body style={{ fontSize: FontSize.xl, marginRight: 12 }}>
                                        {lang.icon}
                                    </Typography.Body>
                                    <Typography.Body style={[styles.settingLabel, { color: theme.text }]}>
                                        {lang.label}
                                    </Typography.Body>
                                </View>
                                {i18n.language === lang.code && (
                                    <FontAwesome name="check" size={18} color={theme.primary} />
                                )}
                            </TouchableOpacity>
                            {index < languages.length - 1 && (
                                <View style={[styles.separator, { backgroundColor: theme.border }]} />
                            )}
                        </React.Fragment>
                    ))}
                </Card>

                <Typography.Subtitle style={[styles.sectionTitle, { marginTop: Spacing.lg, color: theme.primary }]}>
                    {t('appearance')}
                </Typography.Subtitle>
                <Card style={styles.card}>
                    {themes.map((tMode, index) => (
                        <React.Fragment key={tMode.mode}>
                            <TouchableOpacity style={styles.settingItem} onPress={() => setMode(tMode.mode)}>
                                <View style={styles.settingLeft}>
                                    <View style={styles.iconContainer}>
                                        <FontAwesome
                                            name={tMode.icon}
                                            size={18}
                                            color={mode === tMode.mode ? theme.primary : theme.textSecondary}
                                        />
                                    </View>
                                    <Typography.Body style={[styles.settingLabel, { color: theme.text }]}>
                                        {tMode.label}
                                    </Typography.Body>
                                </View>
                                {mode === tMode.mode && <FontAwesome name="check" size={18} color={theme.primary} />}
                            </TouchableOpacity>
                            {index < themes.length - 1 && (
                                <View style={[styles.separator, { backgroundColor: theme.border }]} />
                            )}
                        </React.Fragment>
                    ))}
                </Card>

                {(isAuthRequired || isGuestMode) && (
                    <>
                        <Typography.Subtitle
                            style={[styles.sectionTitle, { marginTop: Spacing.lg, color: theme.primary }]}
                        >
                            {t('account')}
                        </Typography.Subtitle>
                        <Card style={styles.accountCard}>
                            {isGuestMode ? (
                                <>
                                    <View style={{ marginBottom: Spacing.md }}>
                                        <Typography.Meta style={{ color: theme.textSecondary }}>
                                            {t('signInToEnableSync')}
                                        </Typography.Meta>
                                    </View>
                                    <Button
                                        label={t('createAccount')}
                                        onPress={() =>
                                            router.push({ pathname: '../login', params: { mode: 'signup' } })
                                        }
                                    />
                                </>
                            ) : (
                                <>
                                    <View style={{ marginBottom: Spacing.md }}>
                                        <Typography.Meta style={{ color: theme.textSecondary }}>
                                            {t('loggedInAs')}
                                        </Typography.Meta>
                                        <Typography.Body>{userEmail ?? t('notSpecified')}</Typography.Body>
                                    </View>
                                    <Button
                                        label={t('signOut')}
                                        variant={'outline'}
                                        onPress={async () => {
                                            await signOut()
                                            router.replace('../login')
                                        }}
                                    />
                                </>
                            )}
                        </Card>
                    </>
                )}

                <View style={styles.versionWrap}>
                    <Typography.Meta style={{ color: theme.textSecondary }}>{`FitApp - ${appVersion}`}</Typography.Meta>
                </View>
            </Appear>
        </ScrollScreenLayout>
    )
}

const styles = StyleSheet.create({
    sectionTitle: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.heavy,
        letterSpacing: 1.5,
        marginBottom: Spacing.sm + Spacing.xs,
        marginLeft: 4,
        textTransform: 'uppercase',
    },
    card: {
        padding: 0,
        overflow: 'hidden',
    },
    accountCard: {
        padding: Spacing.md,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingLabel: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        marginLeft: Spacing.md,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: Radius.pill,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm + Spacing.xs,
    },
    versionWrap: {
        alignItems: 'center',
        marginTop: Spacing.xl,
    },
})
