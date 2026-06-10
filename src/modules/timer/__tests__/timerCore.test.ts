import { describe, expect, it } from 'vitest'
import {
    clampCountdown,
    createCountdown,
    createStopwatch,
    displayMs,
    elapsedMs,
    finish,
    formatTimerDisplay,
    isCountdownComplete,
    MAX_COUNTDOWN_MS,
    MIN_COUNTDOWN_MS,
    pause,
    remainingMs,
    resume,
    settleDone,
    type TimerState,
} from '../timerCore'

const T0 = 1_000_000 // arbitrary epoch baseline

describe('stopwatch', () => {
    it('counts up from zero based on wall clock', () => {
        const s = createStopwatch(T0)
        expect(displayMs(s, T0)).toBe(0)
        expect(displayMs(s, T0 + 5_000)).toBe(5_000)
        expect(displayMs(s, T0 + 90_000)).toBe(90_000)
    })

    it('never reports a countdown remaining', () => {
        const s = createStopwatch(T0)
        expect(remainingMs(s, T0 + 5_000)).toBe(0)
        expect(isCountdownComplete(s, T0 + 999_000)).toBe(false)
    })

    it('clamps negative elapsed if the clock jumps backwards', () => {
        const s = createStopwatch(T0)
        expect(elapsedMs(s, T0 - 5_000)).toBe(0)
    })
})

describe('countdown', () => {
    it('counts down and reports remaining', () => {
        const s = createCountdown(60_000, T0)
        expect(displayMs(s, T0)).toBe(60_000)
        expect(displayMs(s, T0 + 20_000)).toBe(40_000)
    })

    it('floors remaining at zero and flags completion', () => {
        const s = createCountdown(60_000, T0)
        expect(isCountdownComplete(s, T0 + 59_999)).toBe(false)
        expect(isCountdownComplete(s, T0 + 60_000)).toBe(true)
        expect(remainingMs(s, T0 + 90_000)).toBe(0)
    })

    it('settleDone freezes at zero and is idempotent', () => {
        const s = createCountdown(60_000, T0)
        const done = settleDone(s)
        expect(done.status).toBe('done')
        expect(displayMs(done, T0 + 999_000)).toBe(0)
        expect(isCountdownComplete(done, T0 + 999_000)).toBe(false)
        expect(settleDone(done)).toEqual(done)
    })
})

describe('clampCountdown', () => {
    it('bounds and rounds the target', () => {
        expect(clampCountdown(0)).toBe(MIN_COUNTDOWN_MS)
        expect(clampCountdown(-5)).toBe(MIN_COUNTDOWN_MS)
        expect(clampCountdown(999 * 60_000)).toBe(MAX_COUNTDOWN_MS)
        expect(clampCountdown(60_499)).toBe(60_499)
        expect(clampCountdown(Number.NaN)).toBe(MIN_COUNTDOWN_MS)
    })
})

describe('pause / resume', () => {
    it('freezes elapsed while paused and continues after resume', () => {
        let s: TimerState = createStopwatch(T0)
        s = pause(s, T0 + 10_000)
        expect(s.status).toBe('paused')
        // Time passes while paused — display must not move.
        expect(displayMs(s, T0 + 30_000)).toBe(10_000)
        s = resume(s, T0 + 30_000)
        expect(s.status).toBe('running')
        // Only post-resume time accrues on top of the banked 10s.
        expect(displayMs(s, T0 + 35_000)).toBe(15_000)
    })

    it('preserves remaining across a pause for a countdown', () => {
        let s: TimerState = createCountdown(60_000, T0)
        s = pause(s, T0 + 20_000) // 40s remaining, banked
        expect(remainingMs(s, T0 + 100_000)).toBe(40_000)
        s = resume(s, T0 + 100_000)
        expect(remainingMs(s, T0 + 110_000)).toBe(30_000)
    })

    it('snaps a countdown to the displayed second on pause so the first second after resume is whole', () => {
        // Pause at 20.5s elapsed → 39.5s remaining, shown as 0:40 (ceil).
        let s: TimerState = createCountdown(60_000, T0)
        s = pause(s, T0 + 20_500)
        // Frozen at exactly the displayed 40.0s remaining, not the raw 39.5s.
        expect(remainingMs(s, T0 + 999_000)).toBe(40_000)
        const R = T0 + 999_000
        s = resume(s, R)
        // Holds 0:40 (40000ms, ceil) for a full second after resume.
        expect(remainingMs(s, R + 999)).toBe(39_001)
        expect(remainingMs(s, R + 1_000)).toBe(39_000)
    })

    it('floors a stopwatch to the displayed second on pause', () => {
        let s: TimerState = createStopwatch(T0)
        s = pause(s, T0 + 10_700) // shows 0:10
        expect(displayMs(s, T0 + 999_000)).toBe(10_000)
        const R = T0 + 999_000
        s = resume(s, R)
        expect(displayMs(s, R + 999)).toBe(10_999) // still 0:10 once floored
        expect(displayMs(s, R + 1_000)).toBe(11_000)
    })

    it('pause is a no-op when not running and resume is a no-op when not paused', () => {
        const running = createStopwatch(T0)
        expect(resume(running, T0)).toBe(running)
        const paused = pause(running, T0 + 1_000)
        expect(pause(paused, T0 + 2_000)).toBe(paused)
    })
})

describe('finish (manual stop)', () => {
    it('freezes a running stopwatch at its final floored time and is idempotent', () => {
        const s = createStopwatch(T0)
        const finished = finish(s, T0 + 42_800) // shows 0:42
        expect(finished.status).toBe('done')
        // Time keeps passing, but the frozen final time does not move.
        expect(displayMs(finished, T0 + 999_000)).toBe(42_000)
        expect(finish(finished, T0 + 999_000)).toEqual(finished)
    })

    it('freezes a paused stopwatch at the banked time', () => {
        let s: TimerState = createStopwatch(T0)
        s = pause(s, T0 + 30_000)
        const finished = finish(s, T0 + 90_000)
        expect(finished.status).toBe('done')
        expect(displayMs(finished, T0 + 200_000)).toBe(30_000)
    })
})

describe('restore from wall clock', () => {
    it('a serialized running countdown computes correct remaining after a gap', () => {
        const started = createCountdown(120_000, T0)
        // Simulate app killed, reopened 30s later — same object, new `now`.
        const restored: TimerState = JSON.parse(JSON.stringify(started))
        expect(remainingMs(restored, T0 + 30_000)).toBe(90_000)
        expect(isCountdownComplete(restored, T0 + 130_000)).toBe(true)
    })
})

describe('formatTimerDisplay', () => {
    it('formats M:SS by default with floor', () => {
        expect(formatTimerDisplay(0)).toBe('0:00')
        expect(formatTimerDisplay(5_000)).toBe('0:05')
        expect(formatTimerDisplay(65_000)).toBe('1:05')
        expect(formatTimerDisplay(5_900)).toBe('0:05')
    })

    it('ceils for countdown readability', () => {
        expect(formatTimerDisplay(60_000, true)).toBe('1:00')
        expect(formatTimerDisplay(59_500, true)).toBe('1:00')
        expect(formatTimerDisplay(100, true)).toBe('0:01')
    })

    it('adds an hours segment when needed', () => {
        expect(formatTimerDisplay(3_661_000)).toBe('1:01:01')
    })
})
