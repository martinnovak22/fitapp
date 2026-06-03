import { Duration } from '@/src/constants/Motion'
import React from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown, LinearTransition } from 'react-native-reanimated'

type AppearProps = {
    children: React.ReactNode
    // 'fade' = fade in place; 'down' = fade + slide up from below.
    variant?: 'fade' | 'down'
    // Sequencing / stagger delay before the entrance, in ms.
    delayMs?: number
    // Entrance duration. Exits always use Duration.base (see Motion.ts rule).
    durationMs?: number
    // Animate this view's own box when its size/position changes. Use only on
    // the single element that owns a resize — never nest two of these.
    animateLayout?: boolean
    style?: StyleProp<ViewStyle>
}

// The universal entrance/exit wrapper. Placed inside a conditional
// (`{cond && <Appear>…</Appear>}`) it fades both in and out; on a mounted
// element it just animates the entrance. Using this instead of hand-rolled
// reanimated props is what keeps "animates in but pops out" bugs from
// reappearing — the exit is built in.
export function Appear({
    children,
    variant = 'fade',
    delayMs = 0,
    durationMs = Duration.base,
    animateLayout = false,
    style,
}: AppearProps) {
    const entering = (variant === 'down' ? FadeInDown : FadeIn).duration(durationMs).delay(delayMs)
    const exiting = (variant === 'down' ? FadeOutDown : FadeOut).duration(Duration.base)

    return (
        <Animated.View
            entering={entering}
            exiting={exiting}
            layout={animateLayout ? LinearTransition.duration(Duration.base) : undefined}
            style={style}
        >
            {children}
        </Animated.View>
    )
}
