import { isRemoteDataMode } from '@/src/modules/auth/authMode'

type PrincipalMode = 'local' | 'guest' | 'account' | 'signed-out'

type PrincipalState = {
    mode: PrincipalMode
    userId: string | null
}

let principalState: PrincipalState = {
    mode: isRemoteDataMode() ? 'signed-out' : 'local',
    userId: null,
}

type PrincipalChangeListener = (next: PrincipalState, previous: PrincipalState) => void

const principalChangeListeners = new Set<PrincipalChangeListener>()

export const onPrincipalChange = (listener: PrincipalChangeListener): (() => void) => {
    principalChangeListeners.add(listener)
    return () => {
        principalChangeListeners.delete(listener)
    }
}

export const setActivePrincipal = (next: PrincipalState) => {
    const previous = principalState
    principalState = next
    if (previous.mode === next.mode && previous.userId === next.userId) return
    for (const listener of principalChangeListeners) listener(next, previous)
}

export const getActivePrincipal = (): PrincipalState => principalState

export const getScopedUserId = (): string | null => {
    if (!isRemoteDataMode()) return null
    return principalState.mode === 'account' ? principalState.userId : null
}

export const buildPrincipalWhereClause = (column = 'user_id') => {
    if (!isRemoteDataMode()) {
        return { clause: '1 = 1', params: [] as (string | number | null)[] }
    }

    if (principalState.mode === 'account' && principalState.userId) {
        return { clause: `${column} = ?`, params: [principalState.userId] as (string | number | null)[] }
    }

    if (principalState.mode === 'guest') {
        return { clause: `${column} IS NULL`, params: [] as (string | number | null)[] }
    }

    return { clause: '1 = 0', params: [] as (string | number | null)[] }
}
