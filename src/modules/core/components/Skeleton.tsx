import { LinearGradient } from 'expo-linear-gradient'
import { useCallback, useEffect } from 'react'
import type { DimensionValue, LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native'
import { StyleSheet, View } from 'react-native'
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated'
import { Radius } from '@/src/constants/Radius'
import { useTheme } from '../hooks/useTheme'

const SHIMMER_WIDTH = 160

interface SkeletonBlockProps {
    width?: DimensionValue
    height?: DimensionValue
    borderRadius?: number
    style?: StyleProp<ViewStyle>
}

export function SkeletonBlock({ width, height = 20, borderRadius = Radius.sm, style }: SkeletonBlockProps) {
    const { isDark } = useTheme()
    const shimmerX = useSharedValue(-SHIMMER_WIDTH)
    const blockWidth = useSharedValue(200)

    const startShimmer = useCallback(
        (w: number) => {
            shimmerX.value = -SHIMMER_WIDTH
            shimmerX.value = withRepeat(
                withTiming(w + SHIMMER_WIDTH, {
                    duration: 1400,
                    easing: Easing.bezier(0.4, 0, 0.2, 1),
                }),
                -1,
                false
            )
        },
        [shimmerX]
    )

    // biome-ignore lint/correctness/useExhaustiveDependencies: blockWidth.value read in effect, not render; adding it to deps would read .value during render and trigger Reanimated warning
    useEffect(() => {
        startShimmer(blockWidth.value)
        // Stop the infinite shimmer loop when the skeleton unmounts (after the
        // real content loads), otherwise the animation leaks on a detached node.
        return () => cancelAnimation(shimmerX)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startShimmer])

    const onLayout = (e: LayoutChangeEvent) => {
        const w = e.nativeEvent.layout.width
        if (w !== blockWidth.value) {
            blockWidth.value = w
            startShimmer(w)
        }
    }

    const shimmerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shimmerX.value }],
    }))

    const baseColor = isDark ? '#2C2C2C' : '#D4D4D4'
    const highlightColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)'

    return (
        <View
            onLayout={onLayout}
            // Individual shimmer blocks are decorative; the surrounding skeleton
            // container owns the single "loading" announcement for screen readers.
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={[
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor: baseColor,
                    overflow: 'hidden',
                },
                style,
            ]}
        >
            <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle, { width: SHIMMER_WIDTH }]}>
                <LinearGradient
                    colors={['transparent', highlightColor, 'transparent']}
                    locations={[0, 0.45, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
        </View>
    )
}
