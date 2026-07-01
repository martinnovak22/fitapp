import { describe, expect, it } from 'vitest'
import { capturePrincipalSnapshot, principalHasDiverged } from '../PrincipalSnapshot'

describe('PrincipalSnapshot', () => {
    it('captures an account snapshot with user-scoped clause and is frozen', () => {
        const snap = capturePrincipalSnapshot({ userId: 'user-1' })
        expect(snap.mode).toBe('account')
        expect(snap.userId).toBe('user-1')
        expect(snap.scopeClause).toBe('user_id = ?')
        expect(snap.scopeParams).toEqual(['user-1'])
        expect(Object.isFrozen(snap)).toBe(true)
        expect(Object.isFrozen(snap.scopeParams)).toBe(true)
    })

    it('captures a guest snapshot when no userId', () => {
        const guest = capturePrincipalSnapshot({ userId: null })
        expect(guest.mode).toBe('guest')
        expect(guest.scopeClause).toBe('user_id IS NULL')
        expect(guest.scopeParams).toEqual([])
    })

    it('detects divergence when mode or userId differs from live principal', () => {
        const snap = capturePrincipalSnapshot({ userId: 'user-1' })
        expect(principalHasDiverged(snap, { userId: 'user-1' })).toBe(false)
        expect(principalHasDiverged(snap, { userId: 'user-2' })).toBe(true)
        expect(principalHasDiverged(snap, { userId: null })).toBe(true)
    })
})
