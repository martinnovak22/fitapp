import { describe, expect, it } from 'vitest'
import {
    capturePrincipalSnapshot,
    principalHasDiverged,
} from '../PrincipalSnapshot'

describe('PrincipalSnapshot', () => {
    it('captures an account snapshot with user-scoped clause and is frozen', () => {
        const snap = capturePrincipalSnapshot({ userId: 'user-1', remote: true })
        expect(snap.mode).toBe('account')
        expect(snap.userId).toBe('user-1')
        expect(snap.scopeClause).toBe('user_id = ?')
        expect(snap.scopeParams).toEqual(['user-1'])
        expect(Object.isFrozen(snap)).toBe(true)
        expect(Object.isFrozen(snap.scopeParams)).toBe(true)
    })

    it('captures a guest snapshot when not remote or no userId', () => {
        const guest = capturePrincipalSnapshot({ userId: null, remote: true })
        expect(guest.mode).toBe('guest')
        expect(guest.scopeClause).toBe('user_id IS NULL')
        expect(guest.scopeParams).toEqual([])

        const localOnly = capturePrincipalSnapshot({ userId: 'u', remote: false })
        expect(localOnly.mode).toBe('guest')
    })

    it('detects divergence when mode or userId differs from live principal', () => {
        const snap = capturePrincipalSnapshot({ userId: 'user-1', remote: true })
        expect(principalHasDiverged(snap, { userId: 'user-1', remote: true })).toBe(false)
        expect(principalHasDiverged(snap, { userId: 'user-2', remote: true })).toBe(true)
        expect(principalHasDiverged(snap, { userId: null, remote: true })).toBe(true)
        expect(principalHasDiverged(snap, { userId: 'user-1', remote: false })).toBe(true)
    })
})
