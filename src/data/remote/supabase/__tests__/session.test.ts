import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSupabaseSession, refreshSupabaseAccessToken, setSupabaseTokenRefresher } from '../session'

describe('refreshSupabaseAccessToken', () => {
    beforeEach(() => {
        setSupabaseTokenRefresher(null)
        clearSupabaseSession()
    })

    it('returns null when no refresher is registered', async () => {
        expect(await refreshSupabaseAccessToken()).toBeNull()
    })

    it('delegates to the registered refresher', async () => {
        setSupabaseTokenRefresher(async () => 'fresh')
        expect(await refreshSupabaseAccessToken()).toBe('fresh')
    })

    it('coalesces concurrent refreshes onto a single underlying call', async () => {
        let resolve: (token: string | null) => void = () => {}
        const refresher = vi.fn(() => new Promise<string | null>((r) => (resolve = r)))
        setSupabaseTokenRefresher(refresher)

        const first = refreshSupabaseAccessToken()
        const second = refreshSupabaseAccessToken()
        resolve('fresh')

        expect(await first).toBe('fresh')
        expect(await second).toBe('fresh')
        expect(refresher).toHaveBeenCalledTimes(1)
    })

    it('allows a fresh refresh once the in-flight one has settled', async () => {
        const refresher = vi.fn(async () => 'fresh')
        setSupabaseTokenRefresher(refresher)

        await refreshSupabaseAccessToken()
        await refreshSupabaseAccessToken()

        expect(refresher).toHaveBeenCalledTimes(2)
    })
})
