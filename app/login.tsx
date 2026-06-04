import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    type TextInput,
    TouchableWithoutFeedback,
    View,
} from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Motion } from '@/src/constants/Motion'
import { Spacing } from '@/src/constants/Spacing'
import { FontWeight } from '@/src/constants/Typography'
import { EmailField } from '@/src/modules/auth/components/EmailField'
import { GuestMergeToggle } from '@/src/modules/auth/components/GuestMergeToggle'
import { LoginFormStatus } from '@/src/modules/auth/components/LoginFormStatus'
import { LoginHeader } from '@/src/modules/auth/components/LoginHeader'
import { LoginModeSwitch } from '@/src/modules/auth/components/LoginModeSwitch'
import { PasswordField } from '@/src/modules/auth/components/PasswordField'
import { useLoginForm } from '@/src/modules/auth/useLoginForm'
import { Button } from '@/src/modules/core/components/Button'
import { Card } from '@/src/modules/core/components/Card'
import { Appear } from '@/src/modules/core/components/motion'
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'

// The card owns the single layout transition so the whole form reflows on one
// clock when the confirm-password field appears/disappears.
const cardLayout = Motion.layout()
const cardMaxWidth = 520

export default function LoginScreen() {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const form = useLoginForm()
    const {
        isSignUp,
        email,
        password,
        confirmPassword,
        isPasswordVisible,
        isConfirmPasswordVisible,
        isSubmitting,
        isGoogleSubmitting,
        errorMessage,
        guestDataExists,
        mergeGuestDataOnSignIn,
        canSubmit,
        isGuest,
        setEmail,
        setPassword,
        setConfirmPassword,
        setIsPasswordVisible,
        setIsConfirmPasswordVisible,
        toggleMergeGuestData,
        switchMode,
        submit,
        submitGoogle,
        continueAsGuest,
    } = form

    const emailInputRef = useRef<TextInput>(null)
    const keyboardOffset = useSharedValue(0)

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

        const showSubscription = Keyboard.addListener(showEvent, (event) => {
            const keyboardHeight = event.endCoordinates?.height ?? 0
            keyboardOffset.value = withTiming(Math.min(keyboardHeight * 0.42, 140), { duration: 180 })
        })
        const hideSubscription = Keyboard.addListener(hideEvent, () => {
            keyboardOffset.value = withTiming(0, { duration: 180 })
        })

        return () => {
            showSubscription.remove()
            hideSubscription.remove()
        }
    }, [keyboardOffset])

    const cardAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: -keyboardOffset.value }],
    }))

    return (
        <ScreenLayout style={styles.container}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps={'handled'}
                        showsVerticalScrollIndicator={false}
                    >
                        <Animated.View layout={cardLayout} style={[styles.cardWrapper, cardAnimatedStyle]}>
                            <Card style={styles.card}>
                                <LoginHeader isSignUp={isSignUp} />

                                <Appear variant="down" delayMs={80}>
                                    <Button
                                        label={t('continueWithGoogle')}
                                        leftIcon={'google'}
                                        variant={'secondary'}
                                        onPress={submitGoogle}
                                        isLoading={isGoogleSubmitting}
                                        disabled={isSubmitting || isGoogleSubmitting}
                                        labelStyle={styles.googleButtonText}
                                        style={styles.googleButton}
                                    />
                                </Appear>

                                <Appear variant="down" delayMs={100} style={styles.dividerRow}>
                                    <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                                    <Typography.Meta style={{ color: theme.textSecondary }}>
                                        {t('orContinueWithEmail')}
                                    </Typography.Meta>
                                    <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                                </Appear>

                                <Appear variant="down" delayMs={120} style={styles.fieldGroup}>
                                    <EmailField ref={emailInputRef} value={email} onChangeText={setEmail} />
                                </Appear>

                                <Appear variant="down" delayMs={140} style={styles.fieldGroup}>
                                    <PasswordField
                                        label={t('password')}
                                        value={password}
                                        onChangeText={setPassword}
                                        isVisible={isPasswordVisible}
                                        onToggleVisibility={() => setIsPasswordVisible(!isPasswordVisible)}
                                        textContentType={isSignUp ? 'newPassword' : 'password'}
                                        autoComplete={isSignUp ? 'new-password' : 'current-password'}
                                        returnKeyType={isSignUp ? 'next' : 'done'}
                                        onSubmitEditing={() => {
                                            if (!isSignUp) {
                                                submit()
                                            }
                                        }}
                                    />
                                </Appear>

                                {isSignUp && (
                                    <Appear variant="down" style={styles.fieldGroup}>
                                        <PasswordField
                                            label={t('confirmPassword')}
                                            value={confirmPassword}
                                            onChangeText={setConfirmPassword}
                                            isVisible={isConfirmPasswordVisible}
                                            onToggleVisibility={() =>
                                                setIsConfirmPasswordVisible(!isConfirmPasswordVisible)
                                            }
                                            textContentType={'newPassword'}
                                            autoComplete={'new-password'}
                                            returnKeyType={'done'}
                                            onSubmitEditing={submit}
                                        />
                                    </Appear>
                                )}

                                <LoginFormStatus errorMessage={errorMessage} isSignUp={isSignUp} />

                                <GuestMergeToggle
                                    visible={isGuest && guestDataExists && !isSignUp}
                                    checked={mergeGuestDataOnSignIn}
                                    onToggle={toggleMergeGuestData}
                                />

                                <Appear variant="down" delayMs={160}>
                                    <Button
                                        label={t(isSignUp ? 'createAccount' : 'signIn')}
                                        onPress={submit}
                                        disabled={!canSubmit || isGoogleSubmitting}
                                        isLoading={isSubmitting}
                                        style={styles.submitButton}
                                    />
                                </Appear>
                                <Appear variant="down" delayMs={100} style={styles.dividerRow}>
                                    <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                                    <Typography.Meta style={{ color: theme.textSecondary }}>
                                        {t(isSignUp ? 'alreadyHaveAccount' : 'noAccountYet')}
                                    </Typography.Meta>
                                    <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                                </Appear>
                                <Appear variant="down" delayMs={200}>
                                    <LoginModeSwitch
                                        isSignUp={isSignUp}
                                        onSwitchMode={switchMode}
                                        onContinueAsGuest={continueAsGuest}
                                    />
                                </Appear>
                            </Card>
                        </Animated.View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </ScreenLayout>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingVertical: Spacing.md,
    },
    cardWrapper: {
        width: '100%',
        maxWidth: cardMaxWidth,
        alignSelf: 'center',
    },
    fieldGroup: {
        gap: Spacing.sm,
    },
    card: {
        marginBottom: 0,
    },
    googleButton: {
        minHeight: 48,
        marginBottom: Spacing.md,
    },
    googleButtonText: {
        fontWeight: FontWeight.bold,
    },
    dividerRow: {
        marginBottom: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    submitButton: {
        marginTop: Spacing.sm,
        marginBottom: Spacing.md,
    },
})
