export type SupabaseSession = {
    accessToken: string
    userId: string
}

// The sync engine reads the access token synchronously, but can only recover
// from an expired token by asking the auth layer — which owns the refresh
// token — for a fresh one. The auth layer registers this refresher; the sync
// request path invokes refreshSupabaseAccessToken() on a 401 and retries once,
// so a token that lapses while the app is backgrounded doesn't surface a
// spurious "sync failed" banner on the next foreground cycle.
export type SupabaseTokenRefresher = () => Promise<string | null>

let currentSession: SupabaseSession | null = null
let tokenRefresher: SupabaseTokenRefresher | null = null
let inFlightRefresh: Promise<string | null> | null = null

export const setSupabaseSession = (session: SupabaseSession) => {
    currentSession = session
}

export const clearSupabaseSession = () => {
    currentSession = null
}

export const getSupabaseSession = (): SupabaseSession | null => currentSession

export const setSupabaseTokenRefresher = (refresher: SupabaseTokenRefresher | null) => {
    tokenRefresher = refresher
}

// Coalesces concurrent callers onto a single refresh so a rotating refresh
// token isn't spent twice in parallel (push and pull can both 401 in the same
// cycle). Returns the fresh access token, or null when no refresher is
// registered or the refresh failed.
export const refreshSupabaseAccessToken = async (): Promise<string | null> => {
    const refresher = tokenRefresher
    if (!refresher) return null
    if (inFlightRefresh) return inFlightRefresh
    inFlightRefresh = (async () => {
        try {
            return await refresher()
        } finally {
            inFlightRefresh = null
        }
    })()
    return inFlightRefresh
}
