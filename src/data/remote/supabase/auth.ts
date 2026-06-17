import { getSupabaseConfig, type SupabaseConfig } from '@/src/data/remote/supabase/config'

export type SupabaseAuthSessionData = {
    accessToken: string
    refreshToken: string
    userId: string
    email: string | null
    expiresAt: number
}

export const EMAIL_CONFIRMATION_REQUIRED_CODE = 'email_confirmation_required'
export const RATE_LIMITED_CODE = 'rate_limited'

const AUTH_COOLDOWN_MS = 2000
// Per-operation timestamps so a sign-in attempt doesn't throttle an immediate
// sign-up (and vice-versa). NOTE: this is a client-side UX debounce only — it
// is reset by any app reload and is not a security control. Real brute-force
// protection must be enforced server-side.
const lastAuthAttemptAt: Record<'signIn' | 'signUp', number> = { signIn: 0, signUp: 0 }

const guardRateLimit = (operation: 'signIn' | 'signUp'): void => {
    const now = Date.now()
    if (now - lastAuthAttemptAt[operation] < AUTH_COOLDOWN_MS) {
        throw new SupabaseAuthError(RATE_LIMITED_CODE, 'Please wait before trying again.')
    }
    lastAuthAttemptAt[operation] = now
}

export class SupabaseAuthError extends Error {
    readonly code: string

    constructor(code: string, message: string) {
        super(message)
        this.name = 'SupabaseAuthError'
        this.code = code
    }
}

type SupabaseAuthApiResponse = {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    user?: {
        id?: string
        email?: string | null
    }
    error?: string
    error_description?: string
    msg?: string
}

type SupabaseUserResponse = {
    id?: string
    email?: string | null
}

type AuthRequestOptions = {
    method?: 'GET' | 'POST'
    body?: unknown
    accessToken?: string
}

const parseErrorMessage = (payload: SupabaseAuthApiResponse | null, fallback: string) => {
    if (!payload) return fallback
    return payload.error_description ?? payload.msg ?? payload.error ?? fallback
}

export const authRequest = async <T>(
    config: SupabaseConfig,
    endpoint: string,
    options?: AuthRequestOptions
): Promise<T> => {
    const response = await fetch(`${config.url}/auth/v1/${endpoint}`, {
        method: options?.method ?? 'POST',
        headers: {
            apikey: config.publicKey,
            Authorization: `Bearer ${options?.accessToken ?? config.publicKey}`,
            'Content-Type': 'application/json',
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
    })

    const text = await response.text()
    const payload = text ? (JSON.parse(text) as T) : (null as T)
    if (!response.ok) {
        const errorPayload = (payload as SupabaseAuthApiResponse | null) ?? null
        throw new Error(parseErrorMessage(errorPayload, 'Authentication request failed.'))
    }

    return payload
}

const normalizeSession = (payload: SupabaseAuthApiResponse): SupabaseAuthSessionData => {
    if (!payload.access_token || !payload.refresh_token || !payload.user?.id || !payload.expires_in) {
        throw new Error('Authentication did not return a valid session.')
    }

    return {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        userId: payload.user.id,
        email: payload.user.email ?? null,
        expiresAt: Date.now() + payload.expires_in * 1000,
    }
}

const requireConfig = (): SupabaseConfig => {
    const config = getSupabaseConfig()
    if (!config) {
        throw new Error(
            'Supabase config missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
        )
    }
    return config
}

export const signInWithEmailPassword = async (email: string, password: string): Promise<SupabaseAuthSessionData> => {
    guardRateLimit('signIn')
    const config = requireConfig()
    const payload = await authRequest<SupabaseAuthApiResponse>(config, 'token?grant_type=password', {
        body: { email, password },
    })
    return normalizeSession(payload)
}

export const signUpWithEmailPassword = async (email: string, password: string): Promise<SupabaseAuthSessionData> => {
    guardRateLimit('signUp')
    const config = requireConfig()
    const body: Record<string, unknown> = { email, password }
    if (config.emailRedirectTo) {
        body.email_redirect_to = config.emailRedirectTo
    }

    const payload = await authRequest<SupabaseAuthApiResponse>(config, 'signup', {
        body,
    })

    if (!payload.access_token) {
        throw new SupabaseAuthError(
            EMAIL_CONFIRMATION_REQUIRED_CODE,
            'Sign-up succeeded, but email confirmation is required before login.'
        )
    }

    return normalizeSession(payload)
}

export const refreshSupabaseSession = async (refreshToken: string): Promise<SupabaseAuthSessionData> => {
    const config = requireConfig()
    const payload = await authRequest<SupabaseAuthApiResponse>(config, 'token?grant_type=refresh_token', {
        body: { refresh_token: refreshToken },
    })
    return normalizeSession(payload)
}

export const signOutSupabaseSession = async (accessToken: string): Promise<void> => {
    const config = getSupabaseConfig()
    if (!config) return

    await authRequest<unknown>(config, 'logout', {
        accessToken,
    })
}

export const getSupabaseOAuthAuthorizeUrl = (
    provider: 'google',
    redirectTo: string,
    options?: { flowType?: 'implicit' | 'pkce'; skipBrowserRedirect?: boolean }
): string => {
    const config = requireConfig()
    const params = new URLSearchParams({
        provider,
        redirect_to: redirectTo,
        flow_type: options?.flowType ?? 'implicit',
    })
    if (options?.skipBrowserRedirect) {
        params.set('skip_browser_redirect', 'true')
    }
    return `${config.url}/auth/v1/authorize?${params.toString()}`
}

const parseUrlParams = (raw: string): URLSearchParams => {
    const query = raw.includes('?') ? (raw.split('?')[1]?.split('#')[0] ?? '') : ''
    const fragment = raw.includes('#') ? (raw.split('#')[1] ?? '') : ''
    const params = new URLSearchParams(query)
    const fragmentParams = new URLSearchParams(fragment)
    fragmentParams.forEach((value, key) => {
        params.set(key, value)
    })
    return params
}

const getUserByAccessToken = async (
    config: SupabaseConfig,
    accessToken: string
): Promise<SupabaseUserResponse | null> => {
    const response = await fetch(`${config.url}/auth/v1/user`, {
        method: 'GET',
        headers: {
            apikey: config.publicKey,
            Authorization: `Bearer ${accessToken}`,
        },
    })

    if (!response.ok) return null
    const payload = (await response.json()) as SupabaseUserResponse
    return payload
}

export const getSupabaseSessionFromOAuthRedirectUrl = async (
    redirectUrl: string
): Promise<SupabaseAuthSessionData | null> => {
    const params = parseUrlParams(redirectUrl)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const expiresInRaw = params.get('expires_in')
    const tokenType = params.get('token_type')

    if (!accessToken || !refreshToken) return null
    if (tokenType && tokenType.toLowerCase() !== 'bearer') return null

    const config = requireConfig()
    const user = await getUserByAccessToken(config, accessToken)
    if (!user?.id) {
        throw new Error('OAuth login succeeded, but user profile could not be loaded.')
    }

    const expiresIn = Number.parseInt(expiresInRaw ?? '', 10)
    const safeExpiresIn = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600

    return {
        accessToken,
        refreshToken,
        userId: user.id,
        email: user.email ?? null,
        expiresAt: Date.now() + safeExpiresIn * 1000,
    }
}
