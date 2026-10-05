import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { log } from '@/src/modules/core/utils/logger'
import { type DraftAction, draftReducer, EMPTY_DRAFT, parseDraft, type WorkoutDraft } from '../liveWorkout'

const keyFor = (workoutUuid: string) => `workout-draft:${workoutUuid}`

// Writes are coalesced so typing into a set row doesn't hit storage per keystroke.
const SAVE_DELAY_MS = 300

const writeDraft = (workoutUuid: string, draft: WorkoutDraft) => {
    AsyncStorage.setItem(keyFor(workoutUuid), JSON.stringify(draft)).catch((e) =>
        log('warn', 'Failed to save workout draft', e)
    )
}

const clearWorkoutDraft = async (workoutUuid: string | undefined) => {
    if (!workoutUuid) return
    try {
        await AsyncStorage.removeItem(keyFor(workoutUuid))
    } catch (e) {
        log('warn', 'Failed to clear workout draft', e)
    }
}

// The unchecked set rows of one Workout, kept in device-local storage so they
// survive the app being killed. Never synced: only ✓ writes a Set.
export function useWorkoutDraft(workoutUuid: string | undefined) {
    const [draft, dispatch] = useReducer(draftReducer, EMPTY_DRAFT)
    const [isLoaded, setIsLoaded] = useState(false)
    const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null)
    // Set once the draft is discarded; nothing is written after that.
    const discarded = useRef(false)

    useEffect(() => {
        if (!workoutUuid) return
        let cancelled = false
        AsyncStorage.getItem(keyFor(workoutUuid))
            .then((json) => {
                if (!cancelled) dispatch({ type: 'load', draft: parseDraft(json) })
            })
            .catch((e) => log('warn', 'Failed to read workout draft', e))
            .finally(() => {
                if (!cancelled) setIsLoaded(true)
            })
        return () => {
            cancelled = true
        }
    }, [workoutUuid])

    // Saves shortly after the last change; an unmount (leaving the screen)
    // flushes a pending save instead of dropping it.
    const latest = useRef({ draft, workoutUuid })
    useEffect(() => {
        latest.current = { draft, workoutUuid }
        if (!workoutUuid || !isLoaded || discarded.current) return
        if (pendingSave.current) clearTimeout(pendingSave.current)
        pendingSave.current = setTimeout(() => {
            pendingSave.current = null
            writeDraft(workoutUuid, draft)
        }, SAVE_DELAY_MS)
    }, [draft, isLoaded, workoutUuid])

    useEffect(
        () => () => {
            if (!pendingSave.current || discarded.current) return
            clearTimeout(pendingSave.current)
            const { draft: lastDraft, workoutUuid: lastUuid } = latest.current
            if (lastUuid) writeDraft(lastUuid, lastDraft)
        },
        []
    )

    const update = useCallback((action: DraftAction) => dispatch(action), [])

    // Drops the draft for good (the Workout was finished or deleted), so no
    // pending or unmount save writes it back.
    const discard = useCallback(async () => {
        discarded.current = true
        if (pendingSave.current) clearTimeout(pendingSave.current)
        pendingSave.current = null
        dispatch({ type: 'load', draft: EMPTY_DRAFT })
        await clearWorkoutDraft(latest.current.workoutUuid)
    }, [])

    // Empties the draft but keeps saving: editing a finished Workout again
    // starts from no rows.
    const reset = useCallback(async () => {
        if (pendingSave.current) clearTimeout(pendingSave.current)
        pendingSave.current = null
        dispatch({ type: 'load', draft: EMPTY_DRAFT })
        await clearWorkoutDraft(latest.current.workoutUuid)
    }, [])

    return { draft, isLoaded, update, discard, reset }
}
