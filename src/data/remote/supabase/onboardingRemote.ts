import { getSupabaseConfig } from '@/src/data/remote/supabase/config'
import { getSupabaseSession, refreshSupabaseAccessToken } from '@/src/data/remote/supabase/session'

type ProfileOnboardingRow = { onboarding_completed?: boolean }

// Minimal PostgREST helper scoped to the profiles row. Mirrors the sync
// engine's request path (token refresh + single retry on an expired JWT) so an
// access token that lapsed while backgrounded doesn't spuriously fail the read.
const profilesRequest = async <T>(options: {
    method: 'GET' | 'POST'
    query?: string
    body?: unknown
    prefer?: string
}): Promise<T> => {
    const config = getSupabaseConfig()
    const session = getSupabaseSession()
    if (!config || !session?.accessToken || !session.userId) {
        throw new Error('Onboarding profile request requires an authenticated session.')
    }

    const url = `${config.url}/rest/v1/profiles${options.query ? `?${options.query}` : ''}`

    const send = async (accessToken: string): Promise<{ response: Response; text: string }> => {
        const response = await fetch(url, {
            method: options.method,
            headers: {
                apikey: config.publicKey,
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                ...(options.prefer ? { Prefer: options.prefer } : {}),
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
        })
        return { response, text: await response.text() }
    }

    let { response, text } = await send(session.accessToken)
    if (response.status === 401 && text.toLowerCase().includes('jwt expired')) {
        const refreshed = await refreshSupabaseAccessToken()
        if (refreshed) ({ response, text } = await send(refreshed))
    }

    if (!response.ok) {
        throw new Error(`profiles request failed: ${response.status} ${response.statusText} ${text}`)
    }
    return (text ? JSON.parse(text) : null) as T
}

/** Whether this account has completed onboarding (false when no profile row exists yet). */
export const fetchRemoteOnboardingCompleted = async (userId: string): Promise<boolean> => {
    const rows = await profilesRequest<ProfileOnboardingRow[]>({
        method: 'GET',
        query: `id=eq.${userId}&select=onboarding_completed`,
    })
    return rows?.[0]?.onboarding_completed === true
}

/** Upserts the profile row marking onboarding complete (insert-or-merge on the id PK). */
export const markRemoteOnboardingCompleted = async (userId: string): Promise<void> => {
    await profilesRequest<unknown>({
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: { id: userId, onboarding_completed: true },
    })
}
