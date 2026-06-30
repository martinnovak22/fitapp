import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import { FontWeight } from '@/src/constants/Typography'
import { Button } from '@/src/modules/core/components/Button'

type LoginModeSwitchProps = {
    isSignUp: boolean
    onSwitchMode: () => void
    onContinueAsGuest: () => void
}

// The bottom row that flips sign-in/sign-up and offers "continue as guest".
export function LoginModeSwitch({ isSignUp, onSwitchMode, onContinueAsGuest }: LoginModeSwitchProps) {
    const { t } = useTranslation()

    return (
        <View style={styles.switchRow}>
            <Button
                label={t('continueAsGuest')}
                onPress={onContinueAsGuest}
                variant={'text'}
                size={'sm'}
                labelStyle={styles.switchButtonText}
            />
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
