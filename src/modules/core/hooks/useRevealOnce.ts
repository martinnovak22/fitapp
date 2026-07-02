import { type RefObject, useEffect, useRef } from 'react'

/**
 * Generalizes the "don't float the initial content in over the skeleton"
 * pattern first shipped on the Exercises screen. The skeleton already *is*
 * the entrance — animating the content that replaces it reads as a flash,
 * not a reveal.
 *
 * Returns a ref that latches to `true` the first time `hasLoaded` becomes
 * true, and then never resets — matching the one-way latch used for the
 * skeleton gate itself. Callers gate their entrance animation
 * (`animateOnEnter`) on `hasRevealed.current`, typically combined with a
 * per-item "first seen" check so later insertions (a newly added exercise,
 * a just-finished workout) still animate in normally:
 *
 *     const hasRevealed = useRevealOnce(hasLoaded)
 *     const animateOnEnter = hasRevealed.current && firstSeen
 *
 * A ref (not state) is deliberate: flipping it must not itself trigger a
 * re-render — it's read at the moment content is about to mount.
 */
export const useRevealOnce = (hasLoaded: boolean): RefObject<boolean> => {
    const hasRevealedRef = useRef(false)
    useEffect(() => {
        if (hasLoaded) hasRevealedRef.current = true
    }, [hasLoaded])
    return hasRevealedRef
}
