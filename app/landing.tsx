import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const BACKGROUND_COLOR = '#607d8b';

export default function LandingScreen() {
    const router = useRouter();

    const progress = useSharedValue(0);
    const iconScale = useSharedValue(0.95);

    const iconStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: iconScale.value }],
        };
    });

    const progressBarStyle = useAnimatedStyle(() => {
        return {
            width: `${progress.value * 100}%`,
        };
    });

    const navigateToMain = () => {
        router.replace('/(tabs)/workout');
    };

    useEffect(() => {
        SplashScreen.hideAsync().catch(() => { });

        iconScale.value = withSpring(1.15, {
            damping: 10,
            stiffness: 250
        });

        progress.value = withTiming(1, {
            duration: 1000,
            easing: Easing.bezier(0.4, 0, 0.2, 1)
        }, (finished) => {
            if (finished) {
                runOnJS(navigateToMain)();
            }
        });
    }, []);

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.iconContainer, iconStyle]}>
                <Image
                    source={require('../assets/images/icon.png')}
                    style={styles.icon}
                    resizeMode="contain"
                />
            </Animated.View>

            <View style={styles.loaderTrack}>
                <Animated.View style={[styles.loaderBar, progressBarStyle]} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BACKGROUND_COLOR,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        width: width * 0.55,
        height: width * 0.55,
        backgroundColor: BACKGROUND_COLOR,
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
        backgroundColor: '#4ADE80',
    },
});
