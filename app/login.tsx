import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontWeight } from '@/src/constants/Typography'
import { Button } from '@/src/modules/core/components/Button'
import { Card } from '@/src/modules/core/components/Card'
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { isRemoteDataMode } from '@/src/modules/auth/authMode'
import { useLoginForm } from '@/src/modules/auth/useLoginForm'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from 'react-native'
import Animated, {
    FadeInDown,
    LinearTransition,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'

const formLayoutTransition = LinearTransition.duration(220)
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
                        <Animated.View layout={formLayoutTransition} style={[styles.cardWrapper, cardAnimatedStyle]}>
                            <Card style={styles.card}>
                                <View style={{ marginBottom: Spacing.sm }}>
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

                                <Animated.View entering={FadeInDown.delay(80).duration(220)}>
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
                                </Animated.View>

                                <Animated.View entering={FadeInDown.delay(100).duration(220)} style={styles.dividerRow}>
                                    <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                                    <Typography.Meta style={{ color: theme.textSecondary }}>
                                        {t('orContinueWithEmail')}
                                    </Typography.Meta>
                                    <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                                </Animated.View>

                                <Animated.View
                                    entering={FadeInDown.delay(120).duration(220)}
                                    style={{ gap: Spacing.sm }}
                                >
                                    <Typography.Label>{t('email')}</Typography.Label>
                                    <TextInput
                                        ref={emailInputRef}
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize={'none'}
                                        autoCorrect={false}
                                        keyboardType={'email-address'}
                                        textContentType={'emailAddress'}
                                        autoComplete={'email'}
                                        returnKeyType={'next'}
                                        placeholder={t('emailPlaceholder')}
                                        placeholderTextColor={theme.textSecondary}
                                        style={[
                                            styles.input,
                                            {
                                                color: theme.text,
                                                borderColor: theme.border,
                                                backgroundColor: theme.inputBackground,
                                            },
                                        ]}
                                    />
                                </Animated.View>

                                <Animated.View
                                    entering={FadeInDown.delay(140).duration(220)}
                                    style={{ gap: Spacing.sm }}
                                >
                                    <Typography.Label>{t('password')}</Typography.Label>
                                    <View style={styles.passwordInputContainer}>
                                        <TextInput
                                            value={password}
                                            onChangeText={setPassword}
                                            secureTextEntry={!isPasswordVisible}
                                            autoCorrect={false}
                                            textContentType={isSignUp ? 'newPassword' : 'password'}
                                            autoComplete={isSignUp ? 'new-password' : 'current-password'}
                                            returnKeyType={isSignUp ? 'next' : 'done'}
                                            onSubmitEditing={() => {
                                                if (!isSignUp) {
                                                    submit()
                                                }
                                            }}
                                            placeholder={t('passwordPlaceholder')}
                                            placeholderTextColor={theme.textSecondary}
                                            style={[
                                                styles.input,
                                                styles.passwordInput,
                                                {
                                                    color: theme.text,
                                                    borderColor: theme.border,
                                                    backgroundColor: theme.inputBackground,
                                                },
                                            ]}
                                        />
                                        {password.length > 0 ? (
                                            <Button
                                                leftIcon={isPasswordVisible ? 'eye-slash' : 'eye'}
                                                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                                                variant={'text'}
                                                accessibilityLabel={
                                                    isPasswordVisible ? t('hidePassword') : t('showPassword')
                                                }
                                                labelStyle={{ color: theme.textSecondary }}
                                                style={styles.visibilityButton}
                                            />
                                        ) : null}
                                    </View>
                                </Animated.View>

                                {isSignUp && (
                                    <Animated.View
                                        layout={formLayoutTransition}
                                        entering={FadeInDown.duration(180)}
                                        style={{ gap: Spacing.sm }}
                                    >
                                        <Typography.Label>{t('confirmPassword')}</Typography.Label>
                                        <View style={styles.passwordInputContainer}>
                                            <TextInput
                                                value={confirmPassword}
                                                onChangeText={setConfirmPassword}
                                                secureTextEntry={!isConfirmPasswordVisible}
                                                autoCorrect={false}
                                                textContentType={'newPassword'}
                                                autoComplete={'new-password'}
                                                returnKeyType={'done'}
                                                onSubmitEditing={submit}
                                                placeholder={t('confirmPasswordPlaceholder')}
                                                placeholderTextColor={theme.textSecondary}
                                                style={[
                                                    styles.input,
                                                    styles.passwordInput,
                                                    {
                                                        color: theme.text,
                                                        borderColor: theme.border,
                                                        backgroundColor: theme.inputBackground,
                                                    },
                                                ]}
                                            />
                                            {confirmPassword.length > 0 ? (
                                                <Button
                                                    leftIcon={isConfirmPasswordVisible ? 'eye-slash' : 'eye'}
                                                    onPress={() =>
                                                        setIsConfirmPasswordVisible(!isConfirmPasswordVisible)
                                                    }
                                                    variant={'text'}
                                                    accessibilityLabel={
                                                        isConfirmPasswordVisible ? t('hidePassword') : t('showPassword')
                                                    }
                                                    labelStyle={{ color: theme.textSecondary }}
                                                    style={styles.visibilityButton}
                                                />
                                            ) : null}
                                        </View>
                                    </Animated.View>
                                )}

                                {errorMessage ? (
                                    <Animated.View
                                        layout={formLayoutTransition}
                                        entering={FadeInDown.duration(140)}
                                        style={styles.errorArea}
                                    >
                                        <Typography.Body style={{ color: theme.error }}>{errorMessage}</Typography.Body>
                                    </Animated.View>
                                ) : isSignUp ? (
                                    <Animated.View
                                        layout={formLayoutTransition}
                                        entering={FadeInDown.duration(140)}
                                        style={styles.hintArea}
                                    >
                                        <Typography.Meta style={{ color: theme.textSecondary }}>
                                            {t('passwordMinHint')}
                                        </Typography.Meta>
                                    </Animated.View>
                                ) : null}

                                {isGuest && guestDataExists && !isSignUp ? (
                                    <Animated.View
                                        layout={formLayoutTransition}
                                        entering={FadeInDown.duration(160)}
                                        style={styles.hintArea}
                                    >
                                        <Pressable
                                            style={[styles.migrationRow, { borderColor: theme.border }]}
                                            onPress={toggleMergeGuestData}
                                            accessibilityRole={'checkbox'}
                                            accessibilityLabel={t('mergeGuestDataLabel')}
                                            accessibilityState={{ checked: mergeGuestDataOnSignIn }}
                                        >
                                            <FontAwesome
                                                name={mergeGuestDataOnSignIn ? 'check-square-o' : 'square-o'}
                                                size={18}
                                                color={mergeGuestDataOnSignIn ? theme.primary : theme.textSecondary}
                                            />
                                            <View style={styles.migrationTextWrap}>
                                                <Typography.Meta style={{ color: theme.text }}>
                                                    {t('mergeGuestDataLabel')}
                                                </Typography.Meta>
                                                <Typography.Meta style={{ color: theme.textSecondary }}>
                                                    {t('mergeGuestDataHint')}
                                                </Typography.Meta>
                                            </View>
                                        </Pressable>
                                    </Animated.View>
                                ) : null}

                                <Animated.View entering={FadeInDown.delay(160).duration(220)}>
                                    <Button
                                        label={t(isSignUp ? 'createAccount' : 'signIn')}
                                        onPress={submit}
                                        disabled={!canSubmit || isGoogleSubmitting}
                                        isLoading={isSubmitting}
                                        style={styles.submitButton}
                                    />
                                </Animated.View>
                                <Animated.View entering={FadeInDown.delay(100).duration(220)} style={styles.dividerRow}>
                                    <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                                    <Typography.Meta style={{ color: theme.textSecondary }}>
                                        {t(isSignUp ? 'alreadyHaveAccount' : 'noAccountYet')}
                                    </Typography.Meta>
                                    <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                                </Animated.View>
                                <Animated.View entering={FadeInDown.delay(200).duration(220)}>
                                    <View style={styles.switchRow}>
                                        {isRemoteDataMode() ? (
                                            <Button
                                                label={t('continueAsGuest')}
                                                onPress={continueAsGuest}
                                                variant={'text'}
                                                size={'sm'}
                                                labelStyle={styles.switchButtonText}
                                            />
                                        ) : null}
                                        <Button
                                            label={t(isSignUp ? 'signIn' : 'signUp')}
                                            onPress={switchMode}
                                            variant={'text'}
                                            size={'sm'}
                                            labelStyle={styles.switchButtonText}
                                        />
                                    </View>
                                </Animated.View>
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
    card: {
        marginBottom: 0,
    },
    title: {
        marginBottom: Spacing.xs,
        textAlign: 'center',
    },
    subtitle: {
        marginBottom: Spacing.sm,
        textAlign: 'center',
    },
    migrationRow: {
        borderWidth: 1,
        borderRadius: Radius.sm,
        padding: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
    },
    migrationTextWrap: {
        flex: 1,
    },
    googleButton: {
        minHeight: 48,
        marginBottom: Spacing.md,
    },
    googleButtonText: {
        fontWeight: FontWeight.bold,
    },
    switchButtonText: {
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
    input: {
        borderWidth: 1,
        borderRadius: Radius.sm,
        minHeight: 48,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    passwordInputContainer: {
        position: 'relative',
        justifyContent: 'center',
    },
    passwordInput: {
        paddingRight: Spacing.xl2 + Spacing.sm,
    },
    visibilityButton: {
        position: 'absolute',
        right: Spacing.md,
        top: 0,
        bottom: Spacing.sm,
        justifyContent: 'center',
    },
    errorArea: {
        marginBottom: Spacing.sm,
    },
    hintArea: {
        marginBottom: Spacing.sm,
    },
    submitButton: {
        marginTop: Spacing.sm,
        marginBottom: Spacing.md,
    },
    switchRow: {
        marginTop: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
})
