import { useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dimensions, Image, StyleSheet, View } from 'react-native'
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated'
import { useAuth } from '@/src/modules/auth/useAuth'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { isOnboardingCompleted } from '@/src/modules/core/utils/onboarding'

const { width } = Dimensions.get('window')

export default function LandingScreen() {
    const router = useRouter()
    const { theme } = useTheme()
    // The onboarding flag is account-scoped, so the auth session must be resolved
    // before we read it; otherwise an account user could be misrouted.
    const { isInitialized } = useAuth()
    const [animationDone, setAnimationDone] = useState(false)
    const hasNavigatedRef = useRef(false)

    const progress = useSharedValue(0)
    const iconScale = useSharedValue(0.95)

    const iconStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: iconScale.value }],
        }
    })

    const progressBarStyle = useAnimatedStyle(() => {
        return {
            width: `${progress.value * 100}%`,
        }
    })

    const navigateToMain = useCallback(async () => {
        if (hasNavigatedRef.current) return
        hasNavigatedRef.current = true
        const done = await isOnboardingCompleted()
        router.replace(done ? '/(tabs)/workout' : '/onboarding')
    }, [router])

    useEffect(() => {
        SplashScreen.hideAsync().catch(() => {})

        iconScale.value = withSpring(1.15, {
            damping: 10,
            stiffness: 250,
        })

        progress.value = withTiming(
            1,
            {
                duration: 1000,
                easing: Easing.bezier(0.4, 0, 0.2, 1),
            },
            (finished) => {
                if (finished) {
                    runOnJS(setAnimationDone)(true)
                }
            }
        )
    }, [iconScale, progress])

    // Navigate once the intro animation has played AND auth has resolved, so the
    // account-scoped onboarding check reads a settled session.
    useEffect(() => {
        if (animationDone && isInitialized) {
            navigateToMain()
        }
    }, [animationDone, isInitialized, navigateToMain])

    return (
        <View style={[styles.container, { backgroundColor: theme.iconBackground }]}>
            <Animated.View style={[styles.iconContainer, iconStyle, { backgroundColor: theme.iconBackground }]}>
                <Image source={require('../assets/images/icon.png')} style={styles.icon} resizeMode="contain" />
            </Animated.View>

            <View style={styles.loaderTrack}>
                <Animated.View style={[styles.loaderBar, progressBarStyle, { backgroundColor: theme.primary }]} />
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        width: width * 0.55,
        height: width * 0.55,
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        width: '100%',
        height: '100%',
    },
    loaderTrack: {
        position: 'absolute',
        bottom: 150,
        width: width * 0.5,
        height: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    loaderBar: {
        height: '100%',
    },
})
