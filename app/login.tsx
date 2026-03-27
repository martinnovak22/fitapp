import { Spacing } from '@/src/constants/Spacing'
import {
    EMAIL_CONFIRMATION_REQUIRED_CODE,
    SupabaseAuthError,
    getSupabaseOAuthAuthorizeUrl,
} from '@/src/data/remote/supabase/auth'
import { hasLocalUserData } from '@/src/db/reset'
import { Button } from '@/src/modules/core/components/Button'
import { Card } from '@/src/modules/core/components/Card'
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { showToast } from '@/src/modules/core/utils/toast'
import { isRemoteDataMode } from '@/src/modules/auth/authMode'
import { useAuth } from '@/src/modules/auth/useAuth'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    ActivityIndicator,
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

type AuthMode = 'signin' | 'signup'

const MIN_PASSWORD_LENGTH = 6
const formLayoutTransition = LinearTransition.duration(220)
const cardMaxWidth = 520

const isValidEmail = (value: string): boolean => {
    const normalized = value.trim()
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
}

const mapAuthErrorToMessage = (message: string, t: (key: string) => string): string => {
    const normalized = message.toLowerCase()
    if (normalized.includes('invalid login credentials')) return t('authInvalidCredentials')
    if (normalized.includes('email not confirmed')) return t('authEmailNotConfirmed')
    if (normalized.includes('redirect_to') || (normalized.includes('redirect') && normalized.includes('not allowed'))) {
        return 'Auth redirect URL is not allowed. Check Supabase Redirect URLs.'
    }
    return message.trim() || t('authUnknownError')
}

export default function LoginScreen() {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const { authMode, isAuthenticated, continueAsGuest, signIn, signInWithOAuthRedirectUrl, signUp } = useAuth()
    const { mode: modeParam } = useLocalSearchParams<{ mode?: string | string[] }>()

    const [mode, setMode] = useState<AuthMode>('signin')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [guestDataExists, setGuestDataExists] = useState(false)
    const [mergeGuestDataOnSignIn, setMergeGuestDataOnSignIn] = useState(false)
    const [isPasswordVisible, setIsPasswordVisible] = useState(false)
    const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)
    const emailInputRef = useRef<TextInput>(null)
    const handledOAuthUrlRef = useRef<string | null>(null)
    const keyboardOffset = useSharedValue(0)

    const isSignUp = mode === 'signup'

    useEffect(() => {
        if (isAuthenticated && authMode === 'account') {
            router.replace('/landing')
        }
    }, [authMode, isAuthenticated])

    useEffect(() => {
        const requestedMode = Array.isArray(modeParam) ? modeParam[0] : modeParam
        if (requestedMode !== 'signin' && requestedMode !== 'signup') return
        setMode(requestedMode)
    }, [modeParam])

    useEffect(() => {
        const refreshGuestDataState = async () => {
            if (authMode !== 'guest') {
                setGuestDataExists(false)
                setMergeGuestDataOnSignIn(false)
                return
            }

            try {
                const hasData = await hasLocalUserData()
                setGuestDataExists(hasData)
                setMergeGuestDataOnSignIn(hasData && isSignUp)
            } catch (error) {
                console.error('Failed to detect local guest data:', error)
                setGuestDataExists(false)
                setMergeGuestDataOnSignIn(false)
            }
        }

        void refreshGuestDataState()
    }, [authMode, isSignUp])

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

    const canSubmit = useMemo(() => {
        if (!isValidEmail(email) || password.length < MIN_PASSWORD_LENGTH) return false
        if (isSignUp && password !== confirmPassword) return false
        return true
    }, [confirmPassword, email, isSignUp, password])

    const showEmailConfirmationToast = (value: string) => {
        showToast.info({
            title: t('checkYourEmail'),
            message: t('checkYourEmailDescription', { email: value }),
        })
    }

    const completeGoogleSignInFromUrl = useCallback(
        async (url: string) => {
            if (!url.includes('access_token=') || !url.includes('refresh_token=')) return false
            if (handledOAuthUrlRef.current === url) return true
            handledOAuthUrlRef.current = url

            setIsGoogleSubmitting(true)
            setErrorMessage(null)
            try {
                const applied = await signInWithOAuthRedirectUrl(url, {
                    migrationPolicy: mergeGuestDataOnSignIn ? 'preserve' : 'clear',
                })
                if (!applied) return false
                router.replace('/landing')
                return true
            } catch (error) {
                const message = error instanceof Error ? mapAuthErrorToMessage(error.message, t) : t('authUnknownError')
                setErrorMessage(message)
                return false
            } finally {
                setIsGoogleSubmitting(false)
            }
        },
        [mergeGuestDataOnSignIn, signInWithOAuthRedirectUrl, t]
    )

    useEffect(() => {
        const subscription = Linking.addEventListener('url', (event) => {
            void completeGoogleSignInFromUrl(event.url)
        })
        return () => {
            subscription.remove()
        }
    }, [completeGoogleSignInFromUrl])

    useEffect(() => {
        const hydrateFromInitialUrl = async () => {
            const initialUrl = await Linking.getInitialURL()
            if (!initialUrl) return
            await completeGoogleSignInFromUrl(initialUrl)
        }
        void hydrateFromInitialUrl()
    }, [completeGoogleSignInFromUrl])

    const submitGoogle = async () => {
        if (isSubmitting || isGoogleSubmitting) return

        setErrorMessage(null)
        setIsGoogleSubmitting(true)
        try {
            const redirectTo = process.env.EXPO_PUBLIC_SUPABASE_EMAIL_REDIRECT_TO?.trim() || Linking.createURL('login')
            const authUrl = getSupabaseOAuthAuthorizeUrl('google', redirectTo)
            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo)
            if (result.type === 'success' && result.url) {
                await completeGoogleSignInFromUrl(result.url)
            }
        } catch (error) {
            const message = error instanceof Error ? mapAuthErrorToMessage(error.message, t) : t('authUnknownError')
            setErrorMessage(message)
        }
        setIsGoogleSubmitting(false)
    }

    const submit = async () => {
        if (isSubmitting) return
        const normalizedEmail = email.trim()

        if (!isValidEmail(normalizedEmail)) {
            setErrorMessage(t('validationEmailInvalid'))
            return
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
            setErrorMessage(t('validationPasswordMin'))
            return
        }
        if (isSignUp && password !== confirmPassword) {
            setErrorMessage(t('validationPasswordMismatch'))
            return
        }

        setIsSubmitting(true)
        setErrorMessage(null)
        try {
            if (isSignUp) {
                await signUp(normalizedEmail, password)
                router.replace('/landing')
            } else {
                await signIn(normalizedEmail, password, {
                    migrationPolicy: mergeGuestDataOnSignIn ? 'preserve' : 'clear',
                })
                router.replace('/landing')
            }
        } catch (error) {
            if (error instanceof SupabaseAuthError && error.code === EMAIL_CONFIRMATION_REQUIRED_CODE) {
                showEmailConfirmationToast(normalizedEmail)
                setMode('signin')
                setPassword('')
                setConfirmPassword('')
                return
            }
            const message = error instanceof Error ? mapAuthErrorToMessage(error.message, t) : t('authUnknownError')
            setErrorMessage(message)
        } finally {
            setIsSubmitting(false)
        }
    }

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
                                    <Pressable
                                        onPress={submitGoogle}
                                        disabled={isSubmitting || isGoogleSubmitting}
                                        accessibilityRole={'button'}
                                        accessibilityLabel={t('continueWithGoogle')}
                                        style={[
                                            styles.googleButton,
                                            {
                                                borderColor: theme.border,
                                                backgroundColor: theme.inputBackground,
                                            },
                                            (isSubmitting || isGoogleSubmitting) && styles.googleButtonDisabled,
                                        ]}
                                    >
                                        <View style={styles.googleButtonInner}>
                                            <FontAwesome name={'google'} size={18} color={theme.text} />
                                            <Typography.Body style={{ color: theme.text, fontWeight: '700' }}>
                                                {t('continueWithGoogle')}
                                            </Typography.Body>
                                        </View>
                                        {isGoogleSubmitting ? (
                                            <ActivityIndicator size={'small'} color={theme.textSecondary} />
                                        ) : null}
                                    </Pressable>
                                </Animated.View>

                                <Animated.View entering={FadeInDown.delay(100).duration(220)} style={styles.dividerRow}>
                                    <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                                    <Typography.Meta style={{ color: theme.textSecondary }}>
                                        {t('orContinueWithEmail')}
                                    </Typography.Meta>
                                    <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                                </Animated.View>

                                <Animated.View entering={FadeInDown.delay(120).duration(220)}>
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

                                <Animated.View entering={FadeInDown.delay(140).duration(220)}>
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
                                            <Pressable
                                                style={styles.visibilityButton}
                                                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                                                hitSlop={8}
                                                accessibilityRole={'button'}
                                                accessibilityLabel={
                                                    isPasswordVisible ? t('hidePassword') : t('showPassword')
                                                }
                                            >
                                                <FontAwesome
                                                    name={isPasswordVisible ? 'eye-slash' : 'eye'}
                                                    size={18}
                                                    color={theme.textSecondary}
                                                />
                                            </Pressable>
                                        ) : null}
                                    </View>
                                </Animated.View>

                                {isSignUp && (
                                    <Animated.View layout={formLayoutTransition} entering={FadeInDown.duration(180)}>
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
                                                <Pressable
                                                    style={styles.visibilityButton}
                                                    onPress={() =>
                                                        setIsConfirmPasswordVisible(!isConfirmPasswordVisible)
                                                    }
                                                    hitSlop={8}
                                                    accessibilityRole={'button'}
                                                    accessibilityLabel={
                                                        isConfirmPasswordVisible ? t('hidePassword') : t('showPassword')
                                                    }
                                                >
                                                    <FontAwesome
                                                        name={isConfirmPasswordVisible ? 'eye-slash' : 'eye'}
                                                        size={18}
                                                        color={theme.textSecondary}
                                                    />
                                                </Pressable>
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

                                {authMode === 'guest' && guestDataExists && !isSignUp ? (
                                    <Animated.View
                                        layout={formLayoutTransition}
                                        entering={FadeInDown.duration(160)}
                                        style={styles.hintArea}
                                    >
                                        <Pressable
                                            style={[styles.migrationRow, { borderColor: theme.border }]}
                                            onPress={() => setMergeGuestDataOnSignIn((prev) => !prev)}
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
                                            <Pressable
                                                onPress={async () => {
                                                    await continueAsGuest()
                                                    router.replace('/landing')
                                                }}
                                                hitSlop={8}
                                            >
                                                <Typography.Body style={{ color: theme.primary, fontWeight: '700' }}>
                                                    {t('continueAsGuest')}
                                                </Typography.Body>
                                            </Pressable>
                                        ) : null}
                                        <Pressable
                                            onPress={() => {
                                                setMode(isSignUp ? 'signin' : 'signup')
                                                setErrorMessage(null)
                                            }}
                                            hitSlop={8}
                                        >
                                            <Typography.Body style={{ color: theme.primary, fontWeight: '700' }}>
                                                {t(isSignUp ? 'signIn' : 'signUp')}
                                            </Typography.Body>
                                        </Pressable>
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
    },
    subtitle: {
        marginBottom: Spacing.sm,
    },
    migrationRow: {
        borderWidth: 1,
        borderRadius: 10,
        padding: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
    },
    migrationTextWrap: {
        flex: 1,
    },
    googleButton: {
        borderWidth: 1,
        borderRadius: 10,
        minHeight: 48,
        paddingHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    googleButtonInner: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    googleButtonDisabled: {
        opacity: 0.5,
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
        borderRadius: 10,
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
