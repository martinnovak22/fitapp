import AsyncStorage from '@react-native-async-storage/async-storage'
import type React from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { setActivePrincipal } from '@/src/data/principal'
import {
    type MigrationPolicy,
    type PrincipalIdentity,
    runPrincipalTransition,
} from '@/src/data/principal/PrincipalTransition'
import {
    getSupabaseSessionFromOAuthRedirectUrl,
    refreshSupabaseSession,
    type SupabaseAuthSessionData,
    signInWithEmailPassword,
    signOutSupabaseSession,
    signUpWithEmailPassword,
} from '@/src/data/remote/supabase/auth'
import {
    clearSupabaseSession,
    refreshSupabaseAccessToken,
    setSupabaseSession,
    setSupabaseTokenRefresher,
} from '@/src/data/remote/supabase/session'
import {
    type AuthInitializationEffect,
    type AuthInitializationSession,
    normalizeStoredAuthMode,
    planAuthInitialization,
} from '@/src/modules/auth/authInitialization'
import { isRemoteDataMode } from '@/src/modules/auth/authMode'

type AuthContextValue = {
    isAuthRequired: boolean
    isInitialized: boolean
    isAuthenticated: boolean
    authMode: 'guest' | 'account'
    userEmail: string | null
    signIn: (email: string, password: string, options?: { migrationPolicy?: MigrationPolicy }) => Promise<void>
    signUp: (email: string, password: string) => Promise<void>
    signInWithOAuthRedirectUrl: (url: string, options?: { migrationPolicy?: MigrationPolicy }) => Promise<boolean>
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

/**
 * Runs the side effects produced by {@link planAuthInitialization} and resolves
 * the plan's session value into the concrete session to store in state. The
 * pure transition owns every decision; this runner only performs the I/O.
 */
const runInitializationEffects = async (
    effects: AuthInitializationEffect[],
    plannedSession: AuthInitializationSession
): Promise<SupabaseAuthSessionData | null> => {
    let activeSession: SupabaseAuthSessionData | null = plannedSession === 'refresh-then-apply' ? null : plannedSession

    for (const effect of effects) {
        switch (effect.type) {
            case 'clearSupabaseSession':
                clearSupabaseSession()
                break
            case 'applySession':
                applySession(effect.session)
                break
            case 'persistSession':
                await persistSession(effect.session)
                break
            case 'refreshThenApplyAndPersist': {
                const refreshed = await refreshSupabaseSession(effect.stored.refreshToken)
                applySession(refreshed)
                await persistSession(refreshed)
                activeSession = refreshed
                break
            }
        }
    }

    return activeSession
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isInitialized, setIsInitialized] = useState(false)
    const [session, setSession] = useState<SupabaseAuthSessionData | null>(null)
    const [authMode, setAuthMode] = useState<'guest' | 'account'>('account')
    const isRemoteMode = isRemoteDataMode()
    const isAuthRequired = isRemoteMode && authMode === 'account'

    // The registered token refresher and the periodic refresh both read the
    // live session through this ref, so neither closes over a stale token.
    const sessionRef = useRef(session)
    sessionRef.current = session

    const refreshAccountSession = useCallback(async (): Promise<string | null> => {
        const current = sessionRef.current
        if (!current) return null
        try {
            const refreshed = await refreshSupabaseSession(current.refreshToken)
            applySession(refreshed)
            await persistSession(refreshed)
            setSession(refreshed)
            return refreshed.accessToken
        } catch {
            await AsyncStorage.removeItem(STORAGE_KEY)
            clearSupabaseSession()
            setSession(null)
            return null
        }
    }, [])

    // Expose refresh to the sync engine so an access token that expires
    // mid-cycle is refreshed and the request retried, rather than surfacing a
    // transient "sync failed" banner the user has to dismiss.
    useEffect(() => {
        setSupabaseTokenRefresher(refreshAccountSession)
        return () => setSupabaseTokenRefresher(null)
    }, [refreshAccountSession])

    useEffect(() => {
        if (!isRemoteMode) {
            setActivePrincipal({ mode: 'local', userId: null })
            return
        }
        if (authMode === 'guest') {
            setActivePrincipal({ mode: 'guest', userId: null })
            return
        }
        if (session?.userId) {
            setActivePrincipal({ mode: 'account', userId: session.userId })
            return
        }
        setActivePrincipal({ mode: 'signed-out', userId: null })
    }, [authMode, isRemoteMode, session?.userId])

    const currentIdentity = useCallback((): PrincipalIdentity => {
        if (authMode === 'guest') return { kind: 'guest' }
        if (session?.userId) return { kind: 'account', userId: session.userId }
        return { kind: 'signed-out' }
    }, [authMode, session?.userId])

    const transitionTo = useCallback(
        async (to: PrincipalIdentity, policy: MigrationPolicy) => {
            if (!isRemoteMode) return
            const outcome = await runPrincipalTransition({ from: currentIdentity(), to, policy })
            if (outcome.kind === 'error') {
                throw new Error(`Principal transition failed: ${outcome.message}`)
            }
        },
        [currentIdentity, isRemoteMode]
    )

    useEffect(() => {
        let isMounted = true

        const initialize = async () => {
            if (!isAuthRequired) {
                const plan = planAuthInitialization({
                    isAuthRequired,
                    isRemoteMode,
                    storedAuthMode: null,
                    storedSession: null,
                    now: Date.now(),
                })
                if (isMounted) {
                    runInitializationEffects(plan.effects, null)
                    setSession(null)
                    setIsInitialized(true)
                }
                return
            }

            try {
                const storedAuthMode = isRemoteMode ? await AsyncStorage.getItem(AUTH_MODE_STORAGE_KEY) : null
                const isGuest = isRemoteMode && normalizeStoredAuthMode(storedAuthMode) === 'guest'
                const storedSession = isGuest ? null : await loadStoredSession()
                const plan = planAuthInitialization({
                    isAuthRequired,
                    isRemoteMode,
                    storedAuthMode,
                    storedSession,
                    now: Date.now(),
                })

                if (isMounted && plan.authMode) setAuthMode(plan.authMode)

                const activeSession = await runInitializationEffects(plan.effects, plan.session)
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

        const ensureFreshSession = async () => {
            if (!shouldRefresh(session)) return
            // Coalesced with the sync engine's on-401 refresh so a rotating
            // refresh token is never spent twice in parallel.
            await refreshSupabaseAccessToken()
        }

        void ensureFreshSession()
        const intervalId = setInterval(() => {
            void ensureFreshSession()
        }, 30_000)

        return () => {
            clearInterval(intervalId)
        }
    }, [authMode, isRemoteMode, session])

    const adoptAccountSession = useCallback(async (nextSession: SupabaseAuthSessionData) => {
        await AsyncStorage.setItem(AUTH_MODE_STORAGE_KEY, 'account')
        setAuthMode('account')
        applySession(nextSession)
        await persistSession(nextSession)
        setSession(nextSession)
    }, [])

    const signIn = useCallback(
        async (email: string, password: string, options?: { migrationPolicy?: MigrationPolicy }) => {
            const nextSession = await signInWithEmailPassword(email.trim(), password)
            await transitionTo({ kind: 'account', userId: nextSession.userId }, options?.migrationPolicy ?? 'clear')
            await adoptAccountSession(nextSession)
        },
        [adoptAccountSession, transitionTo]
    )

    const signUp = useCallback(
        async (email: string, password: string) => {
            const nextSession = await signUpWithEmailPassword(email.trim(), password)
            await transitionTo({ kind: 'account', userId: nextSession.userId }, 'preserve')
            await adoptAccountSession(nextSession)
        },
        [adoptAccountSession, transitionTo]
    )

    const signInWithOAuthRedirectUrl = useCallback(
        async (url: string, options?: { migrationPolicy?: MigrationPolicy }) => {
            const nextSession = await getSupabaseSessionFromOAuthRedirectUrl(url)
            if (!nextSession) return false
            await transitionTo({ kind: 'account', userId: nextSession.userId }, options?.migrationPolicy ?? 'clear')
            await adoptAccountSession(nextSession)
            return true
        },
        [adoptAccountSession, transitionTo]
    )

    const continueAsGuest = useCallback(async () => {
        await transitionTo({ kind: 'guest' }, 'clear')
        await AsyncStorage.setItem(AUTH_MODE_STORAGE_KEY, 'guest')
        await AsyncStorage.removeItem(STORAGE_KEY)
        clearSupabaseSession()
        setSession(null)
        setAuthMode('guest')
    }, [transitionTo])

    // Deliberately leaves authMode as 'account': signed-out is represented as
    // account-without-session (the principal layer maps it to 'signed-out'),
    // which is what routes to the login wall here and after a restart.
    // Resetting to 'guest' would instead drop the user into guest mode.
    const signOut = useCallback(async () => {
        const accessToken = session?.accessToken ?? null

        await transitionTo({ kind: 'signed-out' }, 'clear')
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
    }, [session?.accessToken, transitionTo])

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
