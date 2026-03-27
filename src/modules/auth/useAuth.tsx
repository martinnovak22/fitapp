import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
    SupabaseAuthSessionData,
    getSupabaseSessionFromOAuthRedirectUrl,
    refreshSupabaseSession,
    signInWithEmailPassword,
    signOutSupabaseSession,
    signUpWithEmailPassword,
} from '@/src/data/remote/supabase/auth'
import { clearSupabaseSession, setSupabaseSession } from '@/src/data/remote/supabase/session'
import { clearLocalUserData } from '@/src/db/reset'
import { isRemoteDataMode } from '@/src/modules/auth/authMode'

type AuthContextValue = {
    isAuthRequired: boolean
    isInitialized: boolean
    isAuthenticated: boolean
    authMode: 'guest' | 'account'
    userEmail: string | null
    signIn: (email: string, password: string) => Promise<void>
    signUp: (email: string, password: string) => Promise<void>
    signInWithOAuthRedirectUrl: (url: string) => Promise<boolean>
    continueAsGuest: () => Promise<void>
    signOut: () => Promise<void>
}

const STORAGE_KEY = 'supabase-auth-session'
const AUTH_MODE_STORAGE_KEY = 'auth-mode'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const shouldRefresh = (session: SupabaseAuthSessionData): boolean => {
    const refreshBufferMs = 60 * 1000
    return session.expiresAt - Date.now() <= refreshBufferMs
}

const applySession = (session: SupabaseAuthSessionData) => {
    setSupabaseSession({
        accessToken: session.accessToken,
        userId: session.userId,
    })
}

const persistSession = async (session: SupabaseAuthSessionData) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

const loadStoredSession = async (): Promise<SupabaseAuthSessionData | null> => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SupabaseAuthSessionData
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isInitialized, setIsInitialized] = useState(false)
    const [session, setSession] = useState<SupabaseAuthSessionData | null>(null)
    const [authMode, setAuthMode] = useState<'guest' | 'account'>('account')
    const isRemoteMode = isRemoteDataMode()
    const isAuthRequired = isRemoteMode && authMode === 'account'

    const getCurrentPrincipal = useCallback((): string => {
        if (authMode === 'guest') return 'guest'
        if (session?.userId) return `account:${session.userId}`
        return 'signed-out'
    }, [authMode, session?.userId])

    const shouldClearLocalDataOnPrincipalChange = useCallback((currentPrincipal: string, nextPrincipal: string) => {
        if (currentPrincipal === nextPrincipal) return false
        // Preserve guest-created local data when the user creates/signs into an account.
        if (currentPrincipal === 'guest' && nextPrincipal.startsWith('account:')) return false
        // Keep existing local data when moving from signed-out to account.
        if (currentPrincipal === 'signed-out' && nextPrincipal.startsWith('account:')) return false
        return true
    }, [])

    const clearLocalDataOnPrincipalChange = useCallback(
        async (nextPrincipal: string) => {
            if (!isRemoteMode) return
            const currentPrincipal = getCurrentPrincipal()
            if (!shouldClearLocalDataOnPrincipalChange(currentPrincipal, nextPrincipal)) return
            await clearLocalUserData()
        },
        [getCurrentPrincipal, isRemoteMode, shouldClearLocalDataOnPrincipalChange]
    )

    useEffect(() => {
        let isMounted = true

        const initialize = async () => {
            if (!isAuthRequired) {
                if (isMounted) {
                    clearSupabaseSession()
                    setSession(null)
                    setIsInitialized(true)
                }
                return
            }

            try {
                if (isRemoteMode) {
                    const storedModeRaw = await AsyncStorage.getItem(AUTH_MODE_STORAGE_KEY)
                    const storedMode = storedModeRaw === 'guest' ? 'guest' : 'account'
                    if (isMounted) setAuthMode(storedMode)
                    if (storedMode === 'guest') {
                        clearSupabaseSession()
                        if (isMounted) setSession(null)
                        return
                    }
                }

                const stored = await loadStoredSession()
                if (!stored) {
                    clearSupabaseSession()
                    if (isMounted) setSession(null)
                    return
                }

                const activeSession = shouldRefresh(stored) ? await refreshSupabaseSession(stored.refreshToken) : stored
                applySession(activeSession)
                await persistSession(activeSession)
                if (isMounted) setSession(activeSession)
            } catch {
                await AsyncStorage.removeItem(STORAGE_KEY)
                clearSupabaseSession()
                if (isMounted) setSession(null)
            } finally {
                if (isMounted) setIsInitialized(true)
            }
        }

        initialize()

        return () => {
            isMounted = false
        }
    }, [isAuthRequired, isRemoteMode])

    useEffect(() => {
        if (!isRemoteMode || authMode !== 'account' || !session) return

        let isDisposed = false

        const ensureFreshSession = async () => {
            if (!shouldRefresh(session)) return
            try {
                const refreshedSession = await refreshSupabaseSession(session.refreshToken)
                if (isDisposed) return
                applySession(refreshedSession)
                await persistSession(refreshedSession)
                if (isDisposed) return
                setSession(refreshedSession)
            } catch {
                if (isDisposed) return
                await AsyncStorage.removeItem(STORAGE_KEY)
                clearSupabaseSession()
                setSession(null)
            }
        }

        void ensureFreshSession()
        const intervalId = setInterval(() => {
            void ensureFreshSession()
        }, 30_000)

        return () => {
            isDisposed = true
            clearInterval(intervalId)
        }
    }, [authMode, isRemoteMode, session])

    const signIn = useCallback(async (email: string, password: string) => {
        const nextSession = await signInWithEmailPassword(email.trim(), password)
        await clearLocalDataOnPrincipalChange(`account:${nextSession.userId}`)
        await AsyncStorage.setItem(AUTH_MODE_STORAGE_KEY, 'account')
        setAuthMode('account')
        applySession(nextSession)
        await persistSession(nextSession)
        setSession(nextSession)
    }, [clearLocalDataOnPrincipalChange])

    const signUp = useCallback(async (email: string, password: string) => {
        const nextSession = await signUpWithEmailPassword(email.trim(), password)
        await clearLocalDataOnPrincipalChange(`account:${nextSession.userId}`)
        await AsyncStorage.setItem(AUTH_MODE_STORAGE_KEY, 'account')
        setAuthMode('account')
        applySession(nextSession)
        await persistSession(nextSession)
        setSession(nextSession)
    }, [clearLocalDataOnPrincipalChange])

    const signInWithOAuthRedirectUrl = useCallback(async (url: string) => {
        const nextSession = await getSupabaseSessionFromOAuthRedirectUrl(url)
        if (!nextSession) return false
        await clearLocalDataOnPrincipalChange(`account:${nextSession.userId}`)
        await AsyncStorage.setItem(AUTH_MODE_STORAGE_KEY, 'account')
        setAuthMode('account')
        applySession(nextSession)
        await persistSession(nextSession)
        setSession(nextSession)
        return true
    }, [clearLocalDataOnPrincipalChange])

    const continueAsGuest = useCallback(async () => {
        await clearLocalDataOnPrincipalChange('guest')
        await AsyncStorage.setItem(AUTH_MODE_STORAGE_KEY, 'guest')
        await AsyncStorage.removeItem(STORAGE_KEY)
        clearSupabaseSession()
        setSession(null)
        setAuthMode('guest')
    }, [clearLocalDataOnPrincipalChange])

    const signOut = useCallback(async () => {
        const accessToken = session?.accessToken ?? null

        await clearLocalDataOnPrincipalChange('signed-out')
        await AsyncStorage.removeItem(STORAGE_KEY)
        clearSupabaseSession()
        setSession(null)

        if (accessToken) {
            try {
                await signOutSupabaseSession(accessToken)
            } catch {
                // Local sign-out should still complete even when network logout fails.
            }
        }
    }, [clearLocalDataOnPrincipalChange, session?.accessToken])

    const value = useMemo<AuthContextValue>(
        () => ({
            isAuthRequired,
            isInitialized,
            isAuthenticated: authMode === 'guest' || !isAuthRequired || session !== null,
            authMode,
            userEmail: session?.email ?? null,
            signIn,
            signUp,
            signInWithOAuthRedirectUrl,
            continueAsGuest,
            signOut,
        }),
        [
            authMode,
            continueAsGuest,
            isAuthRequired,
            isInitialized,
            session,
            signIn,
            signInWithOAuthRedirectUrl,
            signOut,
            signUp,
        ]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used inside AuthProvider.')
    return context
}
