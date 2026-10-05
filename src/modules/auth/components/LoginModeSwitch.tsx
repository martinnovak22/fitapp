import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import { FontWeight } from '@/src/constants/Typography'
import { Button } from '@/src/modules/core/components/Button'
import { useTheme } from '@/src/modules/core/hooks/useTheme'

type LoginModeSwitchProps = {
    isSignUp: boolean
    onSwitchMode: () => void
    onContinueAsGuest: () => void
}

// The bottom row that flips sign-in/sign-up and offers "continue as guest".
export function LoginModeSwitch({ isSignUp, onSwitchMode, onContinueAsGuest }: LoginModeSwitchProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    // Secondary choices: neutral text, so the accent stays on the form's submit button.
    const linkStyle = [styles.switchButtonText, { color: theme.text }]

    return (
        <View style={styles.switchRow}>
            <Button
                label={t('continueAsGuest')}
                onPress={onContinueAsGuest}
                variant={'text'}
                size={'sm'}
                labelStyle={linkStyle}
            />
            <Button
                label={t(isSignUp ? 'signIn' : 'signUp')}
                onPress={onSwitchMode}
                variant={'text'}
                size={'sm'}
                labelStyle={linkStyle}
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
