import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import type React from 'react'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import {
    createCountdown,
    createStopwatch,
    finish,
    isCountdownComplete,
    pause,
    resume,
    settleDone,
    type TimerState,
} from './timerCore'

// Persisted so a running timer survives a full app kill: the state holds an
// absolute `runningSinceEpoch`, so remaining/elapsed is recomputed from the
// wall clock on the next launch (see timerCore).
const STORAGE_KEY = 'workout-timer-state'

// How often the live display refreshes while running. 500ms keeps the seconds
// flipping crisply without a per-frame cost; correctness never depends on it
// because every value is derived from the wall clock, not counted up here.
const TICK_MS = 500

type TimerContextValue = {
    state: TimerState | null
    // Monotonic clock shared with consumers so they re-render on each tick.
    now: number
    // Bumped once each time a countdown completes while the app is foregrounded,
    // so the pill can play its flash exactly once.
    completionNonce: number
    startStopwatch: () => void
    startCountdown: (targetMs: number) => void
    pauseTimer: () => void
    resumeTimer: () => void
    // Freeze a running timer at its final time without removing it (the stopwatch
    // stop step), so the value can be read before a confirming stopTimer.
    finishTimer: () => void
    stopTimer: () => void
}

const TimerContext = createContext<TimerContextValue | undefined>(undefined)

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<TimerState | null>(null)
    const [now, setNow] = useState(() => Date.now())
    const [completionNonce, setCompletionNonce] = useState(0)

    // Latest state for the interval/listener closures, which capture once.
    const stateRef = useRef<TimerState | null>(null)
    stateRef.current = state

    // Persist on every change; clear when stopped.
    useEffect(() => {
        if (state) {
            void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
        } else {
            void AsyncStorage.removeItem(STORAGE_KEY)
        }
    }, [state])

    // Hydrate once on mount. A countdown that already elapsed while the app was
    // closed is settled silently — the completion cue only fires in-foreground.
    useEffect(() => {
        let cancelled = false
        void (async () => {
            const raw = await AsyncStorage.getItem(STORAGE_KEY)
            if (cancelled || !raw) return
            try {
                const restored = JSON.parse(raw) as TimerState
                const t = Date.now()
                setNow(t)
                setState(isCountdownComplete(restored, t) ? settleDone(restored) : restored)
            } catch {
                await AsyncStorage.removeItem(STORAGE_KEY)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    const fireCompletion = useCallback(() => {
        setState((prev) => (prev ? settleDone(prev) : prev))
        setCompletionNonce((n) => n + 1)
        // Guard the whole call: on a build that predates expo-haptics the native
        // module is absent and may throw synchronously, which a .catch can't trap.
        try {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
        } catch {
            // No haptics on this build — the visual flash still fires.
        }
    }, [])

    // Drive the live tick only while a timer is actually running.
    const isRunning = state?.status === 'running'
    useEffect(() => {
        if (!isRunning) return
        const id = setInterval(() => {
            const t = Date.now()
            setNow(t)
            const current = stateRef.current
            if (current && isCountdownComplete(current, t)) {
                fireCompletion()
            }
        }, TICK_MS)
        return () => clearInterval(id)
    }, [isRunning, fireCompletion])

    // Returning from background: resync the clock immediately (the interval was
    // throttled while away) and settle a countdown that finished off-screen
    // without a cue.
    useEffect(() => {
        const sub = AppState.addEventListener('change', (next) => {
            if (next !== 'active') return
            const t = Date.now()
            setNow(t)
            const current = stateRef.current
            if (current && isCountdownComplete(current, t)) {
                setState(settleDone(current))
            }
        })
        return () => sub.remove()
    }, [])

    const startStopwatch = useCallback(() => {
        const t = Date.now()
        setNow(t)
        setState(createStopwatch(t))
    }, [])

    const startCountdown = useCallback((targetMs: number) => {
        const t = Date.now()
        setNow(t)
        setState(createCountdown(targetMs, t))
    }, [])

    const pauseTimer = useCallback(() => {
        setState((prev) => (prev ? pause(prev, Date.now()) : prev))
    }, [])

    const resumeTimer = useCallback(() => {
        const t = Date.now()
        setNow(t)
        setState((prev) => (prev ? resume(prev, t) : prev))
    }, [])

    const finishTimer = useCallback(() => {
        const t = Date.now()
        setNow(t)
        setState((prev) => (prev ? finish(prev, t) : prev))
    }, [])

    const stopTimer = useCallback(() => {
        setState(null)
    }, [])

    return (
        <TimerContext.Provider
            value={{
                state,
                now,
                completionNonce,
                startStopwatch,
                startCountdown,
                pauseTimer,
                resumeTimer,
                finishTimer,
                stopTimer,
            }}
        >
            {children}
        </TimerContext.Provider>
    )
}

export const useTimer = (): TimerContextValue => {
    const context = useContext(TimerContext)
    if (context === undefined) {
        throw new Error('useTimer must be used within a TimerProvider')
    }
    return context
}
