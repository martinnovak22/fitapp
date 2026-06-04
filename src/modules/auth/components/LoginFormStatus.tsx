import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated'
import { Spacing } from '@/src/constants/Spacing'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'

const layoutTransition = LinearTransition.duration(220)

type LoginFormStatusProps = {
    errorMessage: string | null
    isSignUp: boolean
}

// The single status line under the password fields: the auth error when there
// is one, otherwise the sign-up password hint, otherwise nothing. Owns that
// three-way branch so the screen does not.
export function LoginFormStatus({ errorMessage, isSignUp }: LoginFormStatusProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()

    if (errorMessage) {
        return (
            <Animated.View layout={layoutTransition} entering={FadeInDown.duration(140)} style={styles.errorArea}>
                <Typography.Body style={{ color: theme.error }}>{errorMessage}</Typography.Body>
            </Animated.View>
        )
    }

    if (isSignUp) {
        return (
            <Animated.View layout={layoutTransition} entering={FadeInDown.duration(140)} style={styles.hintArea}>
                <Typography.Meta style={{ color: theme.textSecondary }}>{t('passwordMinHint')}</Typography.Meta>
            </Animated.View>
        )
    }

    return null
}

const styles = StyleSheet.create({
    errorArea: {
        marginBottom: Spacing.sm,
    },
    hintArea: {
        marginBottom: Spacing.sm,
    },
})
