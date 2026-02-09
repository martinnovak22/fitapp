import { Card } from '@/src/modules/core/components/Card';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { Typography } from '@/src/modules/core/components/Typography';
import { useTheme } from '@/src/modules/core/hooks/useTheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function SettingsScreen() {
    const { t, i18n } = useTranslation();
    const { mode, setMode, theme, isDark } = useTheme();

    const languages = [
        { code: 'en', label: t('english'), icon: '🇺🇸' },
        { code: 'cs', label: t('czech'), icon: '🇨🇿' },
    ];

    const themes = [
        { mode: 'light', label: t('lightMode') || 'Light', icon: 'sun-o' },
        { mode: 'dark', label: t('darkMode') || 'Dark', icon: 'moon-o' },
        { mode: 'system', label: t('systemDefault') || 'System', icon: 'desktop' },
    ];

    return (
        <ScreenLayout>
            <ScrollView contentContainerStyle={{ flex: 1 }}>
                <Animated.View entering={FadeInDown.delay(100).duration(500)}>
                    <Typography.Subtitle style={[styles.sectionTitle, { color: theme.primary }]}>{t('language')}</Typography.Subtitle>
                    <Card style={styles.card}>
                        {languages.map((lang, index) => (
                            <React.Fragment key={lang.code}>
                                <TouchableOpacity
                                    style={styles.settingItem}
                                    onPress={() => i18n.changeLanguage(lang.code)}
                                >
                                    <View style={styles.settingLeft}>
                                        <Typography.Body style={{ fontSize: 20, marginRight: 12 }}>{lang.icon}</Typography.Body>
                                        <Typography.Body style={[styles.settingLabel, { color: theme.text }]}>{lang.label}</Typography.Body>
                                    </View>
                                    {i18n.language === lang.code && (
                                        <FontAwesome name="check" size={18} color={theme.primary} />
                                    )}
                                </TouchableOpacity>
                                {index < languages.length - 1 && <View style={[styles.separator, { backgroundColor: theme.border }]} />}
                            </React.Fragment>
                        ))}
                    </Card>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(200).duration(500)}>
                    <Typography.Subtitle style={[styles.sectionTitle, { marginTop: 24, color: theme.primary }]}>{t('appearance') || 'Appearance'}</Typography.Subtitle>
                    <Card style={styles.card}>
                        {themes.map((tMode, index) => (
                            <React.Fragment key={tMode.mode}>
                                <TouchableOpacity
                                    style={styles.settingItem}
                                    onPress={() => setMode(tMode.mode as any)}
                                >
                                    <View style={styles.settingLeft}>
                                        <View style={styles.iconContainer}>
                                            <FontAwesome name={tMode.icon as any} size={18} color={mode === tMode.mode ? theme.primary : theme.textSecondary} />
                                        </View>
                                        <Typography.Body style={[styles.settingLabel, { color: theme.text }]}>{tMode.label}</Typography.Body>
                                    </View>
                                    {mode === tMode.mode && (
                                        <FontAwesome name="check" size={18} color={theme.primary} />
                                    )}
                                </TouchableOpacity>
                                {index < themes.length - 1 && <View style={[styles.separator, { backgroundColor: theme.border }]} />}
                            </React.Fragment>
                        ))}
                    </Card>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(300).duration(500)} style={{ alignItems: 'center', marginTop: "auto", padding: 16 }}>
                    <Typography.Meta style={{ color: theme.textSecondary }}>FitApp - 0.1.2</Typography.Meta>
                </Animated.View>
            </ScrollView>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 1.5,
        marginBottom: 12,
        marginLeft: 4,
        textTransform: 'uppercase',
    },
    card: {
        padding: 0,
        overflow: 'hidden',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 16,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    }
});
