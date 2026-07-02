import { describe, expect, it } from 'vitest'
import { nextHasLoadedOnce, shouldShowSkeleton } from '../loadingGate'

describe('shouldShowSkeleton', () => {
    it('shows the skeleton while hydrating regardless of loading/latch state', () => {
        expect(shouldShowSkeleton({ isHydrating: true, isLoading: false, hasLoadedOnce: false })).toBe(true)
        expect(shouldShowSkeleton({ isHydrating: true, isLoading: false, hasLoadedOnce: true })).toBe(true)
        expect(shouldShowSkeleton({ isHydrating: true, isLoading: true, hasLoadedOnce: false })).toBe(true)
        expect(shouldShowSkeleton({ isHydrating: true, isLoading: true, hasLoadedOnce: true })).toBe(true)
    })

    it('shows the skeleton for the first load (loading, latch not yet set)', () => {
        expect(shouldShowSkeleton({ isHydrating: false, isLoading: true, hasLoadedOnce: false })).toBe(true)
    })

    it('does not show the skeleton for a revisit reload once the latch is set', () => {
        expect(shouldShowSkeleton({ isHydrating: false, isLoading: true, hasLoadedOnce: true })).toBe(false)
    })

    it('does not show the skeleton when idle, whether or not the latch is set', () => {
        expect(shouldShowSkeleton({ isHydrating: false, isLoading: false, hasLoadedOnce: false })).toBe(false)
        expect(shouldShowSkeleton({ isHydrating: false, isLoading: false, hasLoadedOnce: true })).toBe(false)
    })
})

describe('nextHasLoadedOnce', () => {
    it('stays false until a load completes', () => {
        expect(nextHasLoadedOnce(false, false)).toBe(false)
    })

    it('becomes true once a load completes', () => {
        expect(nextHasLoadedOnce(false, true)).toBe(true)
    })

    it('never resets to false once true, even if justLoaded is false', () => {
        expect(nextHasLoadedOnce(true, false)).toBe(true)
    })

    it('stays true across repeated completions', () => {
        expect(nextHasLoadedOnce(true, true)).toBe(true)
    })
})
