// Frozen snapshot of the principal at the moment a sync cycle starts.
//
// Sync push code reads only from this value, never from the live principal.
// A cycle aborts cleanly when the live principal diverges from its snapshot.

export type PrincipalMode = 'guest' | 'account'

export type PrincipalSnapshot = Readonly<{
    mode: PrincipalMode
    userId: string | null
    scopeClause: string
    scopeParams: readonly string[]
}>

export type LivePrincipal = {
    userId: string | null
    remote: boolean
}

export const capturePrincipalSnapshot = (live: LivePrincipal): PrincipalSnapshot => {
    const mode: PrincipalMode = live.remote && !!live.userId ? 'account' : 'guest'
    if (mode === 'account') {
        return Object.freeze({
            mode,
            userId: live.userId,
            scopeClause: 'user_id = ?',
            scopeParams: Object.freeze([live.userId as string]),
        })
    }
    return Object.freeze({
        mode,
        userId: null,
        scopeClause: 'user_id IS NULL',
        scopeParams: Object.freeze([] as string[]),
    })
}

export const principalHasDiverged = (snapshot: PrincipalSnapshot, live: LivePrincipal): boolean => {
    const current = capturePrincipalSnapshot(live)
    return current.mode !== snapshot.mode || current.userId !== snapshot.userId
}
