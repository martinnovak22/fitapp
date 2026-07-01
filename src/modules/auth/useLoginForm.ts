import * as Linking from 'expo-linking'
import { router, useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MigrationPolicy } from '@/src/data/principal/PrincipalTransition'
import {
    EMAIL_CONFIRMATION_REQUIRED_CODE,
    getSupabaseOAuthAuthorizeUrl,
    RATE_LIMITED_CODE,
    SupabaseAuthError,
} from '@/src/data/remote/supabase/auth'
import { hasLocalUserData } from '@/src/db/reset'
import { useAuth } from '@/src/modules/auth/useAuth'
import { log } from '@/src/modules/core/utils/logger'
import { showToast } from '@/src/modules/core/utils/toast'
import { canSubmitLoginForm, mapAuthErrorToMessage, validateLoginForm } from './loginFormLogic'

export type AuthMode = 'signin' | 'signup'

export type UseLoginForm = {
    mode: AuthMode
    isSignUp: boolean
    email: string
    password: string
    confirmPassword: string
    isPasswordVisible: boolean
    isConfirmPasswordVisible: boolean
    isSubmitting: boolean
    isGoogleSubmitting: boolean
    errorMessage: string | null
    guestDataExists: boolean
    mergeGuestDataOnSignIn: boolean
    canSubmit: boolean
    isGuest: boolean
    setEmail: (value: string) => void
    setPassword: (value: string) => void
    setConfirmPassword: (value: string) => void
    setIsPasswordVisible: (value: boolean) => void
    setIsConfirmPasswordVisible: (value: boolean) => void
    toggleMergeGuestData: () => void
    switchMode: () => void
    submit: () => Promise<void>
    submitGoogle: () => Promise<void>
    continueAsGuest: () => Promise<void>
}

// Deep module owning all login-form state and the auth-interaction flow. The
// screen renders over this; rule decisions live in the pure loginFormLogic unit.
export const useLoginForm = (): UseLoginForm => {
    const { t } = useTranslation()
    const { authMode, continueAsGuest, signIn, signInWithOAuthRedirectUrl, signUp } = useAuth()
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
    const handledOAuthUrlRef = useRef<string | null>(null)

    const isSignUp = mode === 'signup'

    // Post-auth navigation is owned by landAfterAuth (called from submit and the
    // OAuth completion), which routes to /merge-review or /landing. No effect
    // redirects on auth state here, so it can't race that decision.

    useEffect(() => {
        const requestedMode = Array.isArray(modeParam) ? modeParam[0] : modeParam
        if (requestedMode !== 'signin' && requestedMode !== 'signup') return
        setMode(requestedMode)
    }, [modeParam])

    useEffect(() => {
        // Guard against a stale run winning: switching to sign-up re-fires this
        // while a prior sign-in run's hasLocalUserData() is still pending, and
        // without this the older result could overwrite the sign-up default.
        let active = true
        const refreshGuestDataState = async () => {
            if (authMode !== 'guest') {
                setGuestDataExists(false)
                setMergeGuestDataOnSignIn(false)
                return
            }

            try {
                const hasData = await hasLocalUserData()
                if (!active) return
                setGuestDataExists(hasData)
                setMergeGuestDataOnSignIn(hasData && isSignUp)
            } catch (error) {
                if (!active) return
                log('error', 'Failed to detect local guest data', error)
                setGuestDataExists(false)
                setMergeGuestDataOnSignIn(false)
            }
        }

        void refreshGuestDataState()
        return () => {
            active = false
        }
    }, [authMode, isSignUp])

    const canSubmit = useMemo(
        () => canSubmitLoginForm({ email, password, confirmPassword, isSignUp }),
        [confirmPassword, email, isSignUp, password]
    )

    // A preserve merge re-owns the guest's rows, but the account's remote rows
    // aren't local yet, so duplicates can't be detected here. Route to the
    // merge-review step (ADR-0005), which pulls, detects, and either shows the
    // review or lands. Every other case lands directly.
    const landAfterAuth = useCallback((migrationPolicy: MigrationPolicy) => {
        router.replace(migrationPolicy === 'preserve' ? '/merge-review' : '/landing')
    }, [])

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
                await landAfterAuth(mergeGuestDataOnSignIn ? 'preserve' : 'clear')
                return true
            } catch (error) {
                const message = error instanceof Error ? mapAuthErrorToMessage(error.message, t) : t('authUnknownError')
                setErrorMessage(message)
                return false
            } finally {
                setIsGoogleSubmitting(false)
            }
        },
        [landAfterAuth, mergeGuestDataOnSignIn, signInWithOAuthRedirectUrl, t]
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

        const validation = validateLoginForm({ email, password, confirmPassword, isSignUp })
        if (!validation.ok) {
            setErrorMessage(t(validation.errorKey))
            return
        }
        const { normalizedEmail } = validation

        setIsSubmitting(true)
        setErrorMessage(null)
        try {
            const migrationPolicy: MigrationPolicy = mergeGuestDataOnSignIn ? 'preserve' : 'clear'
            if (isSignUp) {
                await signUp(normalizedEmail, password, { migrationPolicy })
            } else {
                await signIn(normalizedEmail, password, { migrationPolicy })
            }
            await landAfterAuth(migrationPolicy)
        } catch (error) {
            if (error instanceof SupabaseAuthError && error.code === EMAIL_CONFIRMATION_REQUIRED_CODE) {
                showEmailConfirmationToast(normalizedEmail)
                setMode('signin')
                setPassword('')
                setConfirmPassword('')
                return
            }
            if (error instanceof SupabaseAuthError && error.code === RATE_LIMITED_CODE) {
                setErrorMessage(t('authRateLimited'))
                return
            }
            const message = error instanceof Error ? mapAuthErrorToMessage(error.message, t) : t('authUnknownError')
            setErrorMessage(message)
        } finally {
            setIsSubmitting(false)
        }
    }

    const toggleMergeGuestData = useCallback(() => {
        setMergeGuestDataOnSignIn((prev) => !prev)
    }, [])

    const switchMode = useCallback(() => {
        setMode((prev) => (prev === 'signup' ? 'signin' : 'signup'))
        setErrorMessage(null)
    }, [])

    const continueAsGuestAndLand = useCallback(async () => {
        await continueAsGuest()
        router.replace('/landing')
    }, [continueAsGuest])

    return {
        mode,
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
        isGuest: authMode === 'guest',
        setEmail,
        setPassword,
        setConfirmPassword,
        setIsPasswordVisible,
        setIsConfirmPasswordVisible,
        toggleMergeGuestData,
        switchMode,
        submit,
        submitGoogle,
        continueAsGuest: continueAsGuestAndLand,
    }
}
