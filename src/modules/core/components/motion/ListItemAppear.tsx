import type React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { Duration, staggerDelay } from '@/src/constants/Motion'
import { Appear } from './Appear'

type ListItemAppearProps = {
    // Position in the list — drives the staggered entrance delay.
    index: number
    children: React.ReactNode
    // Suppress the entrance animation (e.g. a screen's initial content reveal,
    // via useRevealOnce) while keeping the built-in exit. Defaults to true.
    animateOnEnter?: boolean
    style?: StyleProp<ViewStyle>
}

// Staggered entrance for list/grid items. Wraps Appear with the shared stagger
// formula so every list in the app cascades on the same timing.
export function ListItemAppear({ index, children, animateOnEnter = true, style }: ListItemAppearProps) {
    return (
        <Appear
            variant="down"
            delayMs={staggerDelay(index)}
            durationMs={Duration.slow}
            animateOnEnter={animateOnEnter}
            style={style}
        >
            {children}
        </Appear>
    )
}
