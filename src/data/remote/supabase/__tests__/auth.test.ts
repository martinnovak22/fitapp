import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/src/data/remote/supabase/config', () => ({
    getSupabaseConfig: () => ({ url: 'https://example.test', publicKey: 'anon-key' }),
}))

const { authRequest, getSupabaseSessionFromOAuthRedirectUrl } = await import('../auth')

type FetchCall = { url: string; method: string; headers: Record<string, string>; body?: string }

type FetchResult = { ok?: boolean; status?: number; body?: unknown; text?: string }

const fetchCalls: FetchCall[] = []

const mockFetch = (handler: (call: FetchCall) => FetchResult) => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const u = typeof url === 'string' ? url : url.toString()
        const headers = (init?.headers ?? {}) as Record<string, string>
        const call: FetchCall = {
            url: u,
            method: init?.method ?? 'GET',
            headers,
            body: init?.body as string | undefined,
        }
        fetchCalls.push(call)
        const result = handler(call)
        const body = result.text !== undefined ? result.text : result.body === undefined ? '' : JSON.stringify(result.body)
        const status = result.status ?? (result.ok === false ? 400 : 200)
        return new Response(body, { status }) as unknown as Response
    }) as typeof fetch
}

const buildImplicitRedirect = (params: Record<string, string>): string => {
    const fragment = new URLSearchParams(params).toString()
    return `fitapp://auth-callback#${fragment}`
}

beforeEach(() => {
    fetchCalls.length = 0
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})

afterEach(() => {
    vi.useRealTimers()
})

describe('getSupabaseSessionFromOAuthRedirectUrl', () => {
    it('parses a present implicit-flow fragment into a session and loads the user', async () => {
        mockFetch(() => ({ body: { id: 'user-123', email: 'user@example.test' } }))

        const session = await getSupabaseSessionFromOAuthRedirectUrl(
            buildImplicitRedirect({
                access_token: 'access-abc',
                refresh_token: 'refresh-xyz',
                expires_in: '7200',
                token_type: 'bearer',
            })
        )

        expect(session).toEqual({
            accessToken: 'access-abc',
            refreshToken: 'refresh-xyz',
            userId: 'user-123',
            email: 'user@example.test',
            expiresAt: new Date('2026-01-01T02:00:00Z').getTime(),
        })
    })

    it('fetches the user with the parsed access token as a bearer credential', async () => {
        mockFetch(() => ({ body: { id: 'user-123', email: null } }))

        await getSupabaseSessionFromOAuthRedirectUrl(
            buildImplicitRedirect({ access_token: 'access-abc', refresh_token: 'refresh-xyz' })
        )

        expect(fetchCalls).toHaveLength(1)
        expect(fetchCalls[0]?.url).toBe('https://example.test/auth/v1/user')
        expect(fetchCalls[0]?.method).toBe('GET')
        expect(fetchCalls[0]?.headers.Authorization).toBe('Bearer access-abc')
    })

    it('reads tokens from the query string as well as the fragment', async () => {
        mockFetch(() => ({ body: { id: 'user-123', email: 'q@example.test' } }))

        const session = await getSupabaseSessionFromOAuthRedirectUrl(
            'fitapp://auth-callback?access_token=q-access&refresh_token=q-refresh'
        )

        expect(session?.accessToken).toBe('q-access')
        expect(session?.refreshToken).toBe('q-refresh')
    })

    it('defaults to a one-hour expiry when expires_in is absent', async () => {
        mockFetch(() => ({ body: { id: 'user-123', email: null } }))

        const session = await getSupabaseSessionFromOAuthRedirectUrl(
            buildImplicitRedirect({ access_token: 'access-abc', refresh_token: 'refresh-xyz' })
        )

        expect(session?.expiresAt).toBe(new Date('2026-01-01T01:00:00Z').getTime())
    })

    it('defaults to a one-hour expiry when expires_in is malformed', async () => {
        mockFetch(() => ({ body: { id: 'user-123', email: null } }))

        const session = await getSupabaseSessionFromOAuthRedirectUrl(
            buildImplicitRedirect({ access_token: 'access-abc', refresh_token: 'refresh-xyz', expires_in: 'not-a-number' })
        )

        expect(session?.expiresAt).toBe(new Date('2026-01-01T01:00:00Z').getTime())
    })

    it('returns null when the redirect carries no fragment or query at all', async () => {
        mockFetch(() => ({ body: { id: 'user-123' } }))

        const session = await getSupabaseSessionFromOAuthRedirectUrl('fitapp://auth-callback')

        expect(session).toBeNull()
        expect(fetchCalls).toHaveLength(0)
    })

    it('returns null when the access token is missing', async () => {
        mockFetch(() => ({ body: { id: 'user-123' } }))

        const session = await getSupabaseSessionFromOAuthRedirectUrl(
            buildImplicitRedirect({ refresh_token: 'refresh-xyz', expires_in: '3600' })
        )

        expect(session).toBeNull()
        expect(fetchCalls).toHaveLength(0)
    })

    it('returns null when the refresh token is missing', async () => {
        mockFetch(() => ({ body: { id: 'user-123' } }))

        const session = await getSupabaseSessionFromOAuthRedirectUrl(
            buildImplicitRedirect({ access_token: 'access-abc', expires_in: '3600' })
        )

        expect(session).toBeNull()
        expect(fetchCalls).toHaveLength(0)
    })

    it('returns null for a non-bearer token type even when tokens are present', async () => {
        mockFetch(() => ({ body: { id: 'user-123' } }))

        const session = await getSupabaseSessionFromOAuthRedirectUrl(
            buildImplicitRedirect({
                access_token: 'access-abc',
                refresh_token: 'refresh-xyz',
                token_type: 'mac',
            })
        )

        expect(session).toBeNull()
        expect(fetchCalls).toHaveLength(0)
    })

    it('returns null when the provider redirects with an OAuth error and no tokens', async () => {
        mockFetch(() => ({ body: { id: 'user-123' } }))

        const session = await getSupabaseSessionFromOAuthRedirectUrl(
            buildImplicitRedirect({ error: 'access_denied', error_description: 'User cancelled' })
        )

        expect(session).toBeNull()
        expect(fetchCalls).toHaveLength(0)
    })

    it('throws when the access token cannot resolve a user profile', async () => {
        mockFetch(() => ({ status: 401, body: { msg: 'invalid token' } }))

        await expect(
            getSupabaseSessionFromOAuthRedirectUrl(
                buildImplicitRedirect({ access_token: 'access-abc', refresh_token: 'refresh-xyz' })
            )
        ).rejects.toThrow('OAuth login succeeded, but user profile could not be loaded.')
    })

    it('throws when the user profile lacks an id', async () => {
        mockFetch(() => ({ body: { email: 'user@example.test' } }))

        await expect(
            getSupabaseSessionFromOAuthRedirectUrl(
                buildImplicitRedirect({ access_token: 'access-abc', refresh_token: 'refresh-xyz' })
            )
        ).rejects.toThrow('OAuth login succeeded, but user profile could not be loaded.')
    })
})

describe('authRequest', () => {
    const config = { url: 'https://example.test', publicKey: 'anon-key' }

    it('posts JSON with apikey and bearer headers by default', async () => {
        mockFetch(() => ({ body: { access_token: 'a' } }))

        const result = await authRequest<{ access_token: string }>(config, 'token?grant_type=password', {
            body: { email: 'a@b.c', password: 'pw' },
        })

        expect(result).toEqual({ access_token: 'a' })
        expect(fetchCalls[0]?.url).toBe('https://example.test/auth/v1/token?grant_type=password')
        expect(fetchCalls[0]?.method).toBe('POST')
        expect(fetchCalls[0]?.headers.apikey).toBe('anon-key')
        expect(fetchCalls[0]?.headers.Authorization).toBe('Bearer anon-key')
        expect(fetchCalls[0]?.body).toBe(JSON.stringify({ email: 'a@b.c', password: 'pw' }))
    })

    it('uses the supplied access token as the bearer credential when given', async () => {
        mockFetch(() => ({ body: {} }))

        await authRequest(config, 'logout', { accessToken: 'session-token' })

        expect(fetchCalls[0]?.headers.Authorization).toBe('Bearer session-token')
    })

    it('honours an explicit GET method and omits a body', async () => {
        mockFetch(() => ({ body: { ok: true } }))

        await authRequest(config, 'user', { method: 'GET' })

        expect(fetchCalls[0]?.method).toBe('GET')
        expect(fetchCalls[0]?.body).toBeUndefined()
    })

    it('returns null for an empty success body', async () => {
        mockFetch(() => ({ text: '' }))

        const result = await authRequest(config, 'logout', { accessToken: 'session-token' })

        expect(result).toBeNull()
    })

    it('throws the server error_description on a failed response', async () => {
        mockFetch(() => ({ status: 400, body: { error_description: 'Invalid login credentials' } }))

        await expect(authRequest(config, 'token?grant_type=password', { body: {} })).rejects.toThrow(
            'Invalid login credentials'
        )
    })

    it('falls back to msg then error then a generic message for error payloads', async () => {
        mockFetch(() => ({ status: 400, body: { msg: 'rate limited' } }))
        await expect(authRequest(config, 'signup', { body: {} })).rejects.toThrow('rate limited')

        mockFetch(() => ({ status: 400, body: { error: 'bad_request' } }))
        await expect(authRequest(config, 'signup', { body: {} })).rejects.toThrow('bad_request')

        mockFetch(() => ({ status: 500, text: '' }))
        await expect(authRequest(config, 'signup', { body: {} })).rejects.toThrow('Authentication request failed.')
    })
})
