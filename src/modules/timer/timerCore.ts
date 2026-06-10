// Pure, wall-clock-based timer engine. No React, no storage, no Date.now() —
// every function takes `now` (epoch ms) so the same logic drives the live tick,
// the AppState foreground re-sync, and restore-after-kill, and so it stays
// trivially unit-testable.
//
// The model is deliberately uniform across both modes: a single accumulated
// `elapsedBeforeMs` plus a `runningSinceEpoch` anchor. Elapsed time is always
// derived from the wall clock, never counted up by a ticking number, so
// backgrounding, locking, or killing the app can never drift the timer.

export type TimerMode = 'stopwatch' | 'countdown'
export type TimerStatus = 'running' | 'paused' | 'done'

export type TimerState = {
    mode: TimerMode
    status: TimerStatus
    // Total target for a countdown, in ms. Always 0 for a stopwatch.
    targetMs: number
    // Elapsed time banked from previous running segments (grows on each pause).
    elapsedBeforeMs: number
    // Epoch ms when the current running segment started, or null when not
    // running (paused / done). Absolute, so elapsed survives an app restart.
    runningSinceEpoch: number | null
}

// Bounds for a countdown target: 1 second to 99 minutes. Keeps the display to
// at most MM:SS and stops absurd inputs from the custom field.
export const MIN_COUNTDOWN_MS = 1_000
export const MAX_COUNTDOWN_MS = 99 * 60_000

export const createStopwatch = (now: number): TimerState => ({
    mode: 'stopwatch',
    status: 'running',
    targetMs: 0,
    elapsedBeforeMs: 0,
    runningSinceEpoch: now,
})

export const createCountdown = (targetMs: number, now: number): TimerState => ({
    mode: 'countdown',
    status: 'running',
    targetMs: clampCountdown(targetMs),
    elapsedBeforeMs: 0,
    runningSinceEpoch: now,
})

export const clampCountdown = (targetMs: number): number => {
    const rounded = Math.round(targetMs)
    if (!Number.isFinite(rounded)) return MIN_COUNTDOWN_MS
    return Math.min(MAX_COUNTDOWN_MS, Math.max(MIN_COUNTDOWN_MS, rounded))
}

// Total elapsed time, clamped to never go negative if the clock jumps back.
export const elapsedMs = (state: TimerState, now: number): number => {
    const live = state.runningSinceEpoch !== null ? Math.max(0, now - state.runningSinceEpoch) : 0
    return state.elapsedBeforeMs + live
}

// Remaining time for a countdown (0 for a stopwatch), floored at zero.
export const remainingMs = (state: TimerState, now: number): number => {
    if (state.mode !== 'countdown') return 0
    return Math.max(0, state.targetMs - elapsedMs(state, now))
}

// The number the UI shows: counting up for a stopwatch, counting down otherwise.
export const displayMs = (state: TimerState, now: number): number =>
    state.mode === 'countdown' ? remainingMs(state, now) : elapsedMs(state, now)

// True once a running/paused countdown has reached zero and should freeze.
export const isCountdownComplete = (state: TimerState, now: number): boolean =>
    state.mode === 'countdown' && state.status !== 'done' && elapsedMs(state, now) >= state.targetMs

export const pause = (state: TimerState, now: number): TimerState => {
    if (state.status !== 'running') return state
    return {
        ...state,
        status: 'paused',
        // Snap the banked elapsed to the whole second currently on screen. Without
        // this, a pause at e.g. 39.5s-remaining banks the fraction, so the first
        // second after resume crosses to the next number in ~0.5s and reads as a
        // fast tick. Aligning to the displayed value makes the first second whole.
        elapsedBeforeMs: quantizeElapsed(state, now),
        runningSinceEpoch: null,
    }
}

// Elapsed time rounded so the *displayed* value is preserved exactly across a
// pause: floor for a stopwatch (counts up, floored), and for a countdown the
// elapsed that yields the ceil'd remaining the UI is showing.
const quantizeElapsed = (state: TimerState, now: number): number => {
    const elapsed = elapsedMs(state, now)
    if (state.mode === 'countdown') {
        const remaining = Math.max(0, state.targetMs - elapsed)
        const displayedRemaining = Math.ceil(remaining / 1000) * 1000
        return Math.max(0, state.targetMs - displayedRemaining)
    }
    return Math.floor(elapsed / 1000) * 1000
}

export const resume = (state: TimerState, now: number): TimerState => {
    if (state.status !== 'paused') return state
    return { ...state, status: 'running', runningSinceEpoch: now }
}

// Freeze a finished countdown at exactly 0:00. Idempotent.
export const settleDone = (state: TimerState): TimerState => {
    if (state.mode !== 'countdown' || state.status === 'done') return state
    return {
        ...state,
        status: 'done',
        elapsedBeforeMs: state.targetMs,
        runningSinceEpoch: null,
    }
}

// Freeze a timer at the elapsed time it shows right now. Used when the user
// stops a stopwatch: instead of vanishing, it holds the final time until a
// second confirming tap removes it. Floored to the displayed second so the
// frozen value matches what was on screen the instant before. Idempotent.
export const finish = (state: TimerState, now: number): TimerState => {
    if (state.status === 'done') return state
    return {
        ...state,
        status: 'done',
        elapsedBeforeMs: Math.floor(elapsedMs(state, now) / 1000) * 1000,
        runningSinceEpoch: null,
    }
}

// Format ms as M:SS (or MM:SS / H:MM:SS when large). `ceil` rounds up, which
// reads better for a countdown — a 60s timer shows 1:00 for the first whole
// second instead of dropping to 0:59 immediately.
export const formatTimerDisplay = (ms: number, ceil = false): string => {
    const totalSeconds = (ceil ? Math.ceil : Math.floor)(Math.max(0, ms) / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const pad = (n: number) => n.toString().padStart(2, '0')
    if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
    return `${minutes}:${pad(seconds)}`
}
