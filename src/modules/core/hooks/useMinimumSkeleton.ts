import { useEffect, useRef, useState } from 'react'

// Once a skeleton becomes visible it stays visible for at least this long, even
// if the data resolves sooner. Below this, a cached/instant load flashes the
// skeleton for a few frames and vanishes, which reads as a flicker.
const MIN_VISIBLE_MS = 500

/**
 * Wraps a screen's raw "show skeleton" decision so the skeleton, once shown,
 * remains visible for at least MIN_VISIBLE_MS. A fast (cached) load therefore
 * shows a clean, brief skeleton instead of a sub-perceptual flash.
 *
 * A load that never shows the skeleton (e.g. a revisit where data is already
 * present) returns false throughout — the minimum only applies once the
 * skeleton has actually appeared.
 */
export function useMinimumSkeleton(active: boolean, minMs = MIN_VISIBLE_MS): boolean {
    const [visible, setVisible] = useState(active)
    const shownAtRef = useRef<number | null>(active ? Date.now() : null)

    useEffect(() => {
        if (active) {
            if (shownAtRef.current === null) shownAtRef.current = Date.now()
            setVisible(true)
            return
        }
        // The skeleton was never shown — nothing to hold open.
        if (shownAtRef.current === null) {
            setVisible(false)
            return
        }
        const remaining = minMs - (Date.now() - shownAtRef.current)
        if (remaining <= 0) {
            shownAtRef.current = null
            setVisible(false)
            return
        }
        const timeout = setTimeout(() => {
            shownAtRef.current = null
            setVisible(false)
        }, remaining)
        return () => clearTimeout(timeout)
    }, [active, minMs])

    return visible
}
