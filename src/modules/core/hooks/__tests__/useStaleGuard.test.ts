import { describe, expect, it } from 'vitest'
import { createStaleGuard } from '../useStaleGuard'

describe('createStaleGuard', () => {
    it('keeps a sole run fresh', () => {
        const begin = createStaleGuard()
        const isStale = begin()
        expect(isStale()).toBe(false)
    })

    it('marks an earlier run stale once a newer one begins', () => {
        const begin = createStaleGuard()
        const first = begin()
        const second = begin()

        expect(first()).toBe(true)
        expect(second()).toBe(false)
    })

    it('only the latest of many concurrent runs stays fresh', () => {
        const begin = createStaleGuard()
        const runs = [begin(), begin(), begin(), begin()]

        expect(runs.map((isStale) => isStale())).toEqual([true, true, true, false])
    })

    it('independent guards do not interfere', () => {
        const a = createStaleGuard()
        const b = createStaleGuard()
        const aRun = a()
        b()

        expect(aRun()).toBe(false)
    })
})
