import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Spacing } from '@/src/constants/Spacing'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'

type LoginHeaderProps = {
    isSignUp: boolean
}

// Card title + subtitle. Owns the sign-in/sign-up copy swap for both lines.
export function LoginHeader({ isSignUp }: LoginHeaderProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()

    return (
        <View style={styles.header}>
            <Animated.View entering={FadeInDown.duration(220)}>
                <Typography.Title style={styles.title}>
                    {t(isSignUp ? 'createAccount' : 'welcomeBack')}
                </Typography.Title>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(40).duration(220)}>
                <Typography.Body style={[styles.subtitle, { color: theme.textSecondary }]}>
                    {t(isSignUp ? 'authSignUpSubtitle' : 'authSignInSubtitle')}
                </Typography.Body>
            </Animated.View>
        </View>
    )
}

const styles = StyleSheet.create({
    header: {
        marginBottom: Spacing.sm,
    },
    title: {
        marginBottom: Spacing.xs,
        textAlign: 'center',
    },
    subtitle: {
        marginBottom: Spacing.sm,
        textAlign: 'center',
    },
})
