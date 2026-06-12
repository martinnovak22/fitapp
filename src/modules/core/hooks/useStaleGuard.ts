import { useRef } from 'react'

/**
 * Latest-wins guard for loaders with multiple triggers (focus effect,
 * post-sync reload, pull-to-refresh). Concurrent runs race: while a sync is
 * writing, an earlier run can read a partial snapshot yet resolve last,
 * clobbering the fresh run's state with stale data.
 *
 * Each call to `begin()` supersedes all previous runs and returns that run's
 * `isStale()` check. Loaders compute into locals and bail before committing
 * state when superseded:
 *
 *     const beginLoad = useStaleGuard()
 *     const loadData = useCallback(async () => {
 *         const isStale = beginLoad()
 *         const data = await repo.getAll()
 *         if (isStale()) return
 *         setData(data)
 *     }, [beginLoad, repo])
 */
export const createStaleGuard = (): (() => () => boolean) => {
    let latest = 0
    return () => {
        const id = ++latest
        return () => id !== latest
    }
}

export const useStaleGuard = (): (() => () => boolean) => {
    const guardRef = useRef<ReturnType<typeof createStaleGuard> | null>(null)
    if (!guardRef.current) guardRef.current = createStaleGuard()
    return guardRef.current
}
