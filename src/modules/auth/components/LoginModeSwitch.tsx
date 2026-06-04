import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import { FontWeight } from '@/src/constants/Typography'
import { isRemoteDataMode } from '@/src/modules/auth/authMode'
import { Button } from '@/src/modules/core/components/Button'

type LoginModeSwitchProps = {
    isSignUp: boolean
    onSwitchMode: () => void
    onContinueAsGuest: () => void
}

// The bottom row that flips sign-in/sign-up and, in remote-data mode, offers
// "continue as guest". Owns the data-mode branch that decides whether the guest
// shortcut is shown.
export function LoginModeSwitch({ isSignUp, onSwitchMode, onContinueAsGuest }: LoginModeSwitchProps) {
    const { t } = useTranslation()

    return (
        <View style={styles.switchRow}>
            {isRemoteDataMode() ? (
                <Button
                    label={t('continueAsGuest')}
                    onPress={onContinueAsGuest}
                    variant={'text'}
                    size={'sm'}
                    labelStyle={styles.switchButtonText}
                />
            ) : null}
            <Button
                label={t(isSignUp ? 'signIn' : 'signUp')}
                onPress={onSwitchMode}
                variant={'text'}
                size={'sm'}
                labelStyle={styles.switchButtonText}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    switchRow: {
        marginTop: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    switchButtonText: {
        fontWeight: FontWeight.bold,
    },
})
