import { Duration } from '@/src/constants/Motion'
import React from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated'

type CollapsibleProps = {
    // Whether the content is shown. Toggling animates the height + a fade.
    expanded: boolean
    children: React.ReactNode
    style?: StyleProp<ViewStyle>
}

// Owns the height animation for a single expand/collapse region: the outer
// view animates its layout while the inner content fades, so neighbours slide
// rather than jump. Use this instead of scattering `layout` props across
// nested children — those run on independent clocks and visibly desync (the
// footer-overshoot bug we hit in the set-logging sheet).
export function Collapsible({ expanded, children, style }: CollapsibleProps) {
    return (
        <Animated.View layout={LinearTransition.duration(Duration.base)} style={style}>
            {expanded && (
                <Animated.View entering={FadeIn.duration(Duration.base)} exiting={FadeOut.duration(Duration.base)}>
                    {children}
                </Animated.View>
            )}
        </Animated.View>
    )
}
