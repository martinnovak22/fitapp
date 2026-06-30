import type { SupabaseAuthSessionData } from '@/src/data/remote/supabase/auth'

/**
 * Pure, React-free description of auth bootstrap. Given the resolved inputs
 * (whether auth is required, the stored auth mode, the stored session, and the
 * current time), it decides the next observable state and the ordered list of
 * side effects the caller must run. No I/O happens here.
 */

export type AuthMode = 'guest' | 'account'

const REFRESH_BUFFER_MS = 60 * 1000

export type AuthInitializationInput = {
    isAuthRequired: boolean
    /** Raw value read from auth-mode storage; null when absent. */
    storedAuthMode: string | null
    storedSession: SupabaseAuthSessionData | null
    now: number
}

export type AuthInitializationEffect =
    | { type: 'clearSupabaseSession' }
    | { type: 'applySession'; session: SupabaseAuthSessionData }
    | { type: 'persistSession'; session: SupabaseAuthSessionData }
    | { type: 'refreshThenApplyAndPersist'; stored: SupabaseAuthSessionData }

/**
 * The next observable session value:
 * - `null` — no active session
 * - a session object — apply this exact session
 * - `'refresh-then-apply'` — the session must be refreshed first; the resulting
 *   session is what becomes active (the caller resolves it while running the
 *   `refreshThenApplyAndPersist` effect).
 */
export type AuthInitializationSession = SupabaseAuthSessionData | null | 'refresh-then-apply'

export type AuthInitializationPlan = {
    authMode: AuthMode | null
    session: AuthInitializationSession
    markInitialized: boolean
    effects: AuthInitializationEffect[]
}

const shouldRefresh = (session: SupabaseAuthSessionData, now: number): boolean =>
    session.expiresAt - now <= REFRESH_BUFFER_MS

export const normalizeStoredAuthMode = (raw: string | null): AuthMode => (raw === 'guest' ? 'guest' : 'account')

export const planAuthInitialization = (input: AuthInitializationInput): AuthInitializationPlan => {
    if (!input.isAuthRequired) {
        return {
            authMode: null,
            session: null,
            markInitialized: true,
            effects: [{ type: 'clearSupabaseSession' }],
        }
    }

    const storedMode = normalizeStoredAuthMode(input.storedAuthMode)

    if (storedMode === 'guest') {
        return {
            authMode: 'guest',
            session: null,
            markInitialized: true,
            effects: [{ type: 'clearSupabaseSession' }],
        }
    }

    if (!input.storedSession) {
        return {
            authMode: storedMode,
            session: null,
            markInitialized: true,
            effects: [{ type: 'clearSupabaseSession' }],
        }
    }

    const stored = input.storedSession

    if (shouldRefresh(stored, input.now)) {
        return {
            authMode: storedMode,
            session: 'refresh-then-apply',
            markInitialized: true,
            effects: [{ type: 'refreshThenApplyAndPersist', stored }],
        }
    }

    return {
        authMode: storedMode,
        session: stored,
        markInitialized: true,
        effects: [
            { type: 'applySession', session: stored },
            { type: 'persistSession', session: stored },
        ],
    }
}
