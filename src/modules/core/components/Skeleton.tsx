import { type ReactNode, useEffect } from 'react'
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native'
import { View } from 'react-native'
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated'
import { Duration } from '@/src/constants/Motion'
import { Radius } from '@/src/constants/Radius'
import { useTheme } from '../hooks/useTheme'

interface SkeletonBlockProps {
    width?: DimensionValue
    height?: DimensionValue
    borderRadius?: number
    style?: StyleProp<ViewStyle>
}

// A skeleton placeholder block. Deliberately a plain, non-animated View: the
// pulse is owned by a single SkeletonPulse driver at the skeleton root. A
// screenful of ~30 blocks therefore mounts as ~30 plain views instead of ~30
// reanimated views — the latter cost 1.5–3s to commit on a cold navigation,
// which was the first-navigation freeze.
export function SkeletonBlock({ width, height = 20, borderRadius = Radius.sm, style }: SkeletonBlockProps) {
    const { theme } = useTheme()
    return (
        <View
            // Individual blocks are decorative; the surrounding skeleton container
            // owns the single "loading" announcement for screen readers.
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={[{ width, height, borderRadius, backgroundColor: theme.skeletonBase }, style]}
        />
    )
}

// Single animation driver for a whole skeleton. Wrap a skeleton's blocks in one
// SkeletonPulse and the entire subtree gently breathes on ONE reanimated opacity
// loop, instead of every block running its own — which is what keeps the mount
// cheap. Uses the shared shimmer token so every skeleton pulses on one clock.
export function SkeletonPulse({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
    const opacity = useSharedValue(0.3)

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(1, { duration: Duration.shimmer, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        )
        // Stop the loop when the skeleton unmounts (after the real content loads),
        // otherwise the animation leaks on a detached node.
        return () => cancelAnimation(opacity)
    }, [opacity])

    const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

    return <Animated.View style={[pulseStyle, style]}>{children}</Animated.View>
}
