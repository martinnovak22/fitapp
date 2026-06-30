import { describe, expect, it } from 'vitest'
import type { SupabaseAuthSessionData } from '@/src/data/remote/supabase/auth'
import { planAuthInitialization } from '../authInitialization'

const NOW = 1_000_000

const session = (overrides: Partial<SupabaseAuthSessionData> = {}): SupabaseAuthSessionData => ({
    accessToken: 'access',
    refreshToken: 'refresh',
    userId: 'user-A',
    email: 'a@example.com',
    expiresAt: NOW + 60 * 60 * 1000,
    ...overrides,
})

describe('planAuthInitialization', () => {
    describe('auth not required (guest mode)', () => {
        it('clears the session, sets no session, and marks initialized', () => {
            const plan = planAuthInitialization({
                isAuthRequired: false,
                storedAuthMode: null,
                storedSession: null,
                now: NOW,
            })

            expect(plan.authMode).toBeNull()
            expect(plan.session).toBeNull()
            expect(plan.markInitialized).toBe(true)
            expect(plan.effects).toEqual([{ type: 'clearSupabaseSession' }])
        })
    })

    describe('guest mode (auth not required because stored mode is guest)', () => {
        it('clears the session and sets auth mode to guest', () => {
            const plan = planAuthInitialization({
                isAuthRequired: true,
                storedAuthMode: 'guest',
                storedSession: session(),
                now: NOW,
            })

            expect(plan.authMode).toBe('guest')
            expect(plan.session).toBeNull()
            expect(plan.markInitialized).toBe(true)
            expect(plan.effects).toEqual([{ type: 'clearSupabaseSession' }])
        })
    })

    describe('account mode (auth required, stored account)', () => {
        it('with no stored session: sets account mode, clears session', () => {
            const plan = planAuthInitialization({
                isAuthRequired: true,
                storedAuthMode: 'account',
                storedSession: null,
                now: NOW,
            })

            expect(plan.authMode).toBe('account')
            expect(plan.session).toBeNull()
            expect(plan.markInitialized).toBe(true)
            expect(plan.effects).toEqual([{ type: 'clearSupabaseSession' }])
        })

        it('with a fresh stored session: applies and persists it without refreshing', () => {
            const stored = session()
            const plan = planAuthInitialization({
                isAuthRequired: true,
                storedAuthMode: 'account',
                storedSession: stored,
                now: NOW,
            })

            expect(plan.authMode).toBe('account')
            expect(plan.session).toBe(stored)
            expect(plan.markInitialized).toBe(true)
            expect(plan.effects).toEqual([
                { type: 'applySession', session: stored },
                { type: 'persistSession', session: stored },
            ])
        })

        it('with a near-expiry stored session: refreshes before applying and persisting', () => {
            const stored = session({ expiresAt: NOW + 30 * 1000 })
            const plan = planAuthInitialization({
                isAuthRequired: true,
                storedAuthMode: 'account',
                storedSession: stored,
                now: NOW,
            })

            expect(plan.authMode).toBe('account')
            expect(plan.session).toBe('refresh-then-apply')
            expect(plan.markInitialized).toBe(true)
            expect(plan.effects).toEqual([{ type: 'refreshThenApplyAndPersist', stored }])
        })
    })

    describe('defaulting of stored auth mode', () => {
        it('treats an unknown stored mode as account', () => {
            const plan = planAuthInitialization({
                isAuthRequired: true,
                storedAuthMode: 'something-else',
                storedSession: null,
                now: NOW,
            })

            expect(plan.authMode).toBe('account')
        })
    })
})
