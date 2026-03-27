import { isRemoteDataMode } from '@/src/modules/auth/authMode'

export type PrincipalMode = 'local' | 'guest' | 'account' | 'signed-out'

type PrincipalState = {
    mode: PrincipalMode
    userId: string | null
}

let principalState: PrincipalState = {
    mode: isRemoteDataMode() ? 'signed-out' : 'local',
    userId: null,
}

export const setActivePrincipal = (next: PrincipalState) => {
    principalState = next
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
