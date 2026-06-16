import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useRouter } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Dimensions,
    FlatList,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontWeight } from '@/src/constants/Typography'
import { Button } from '@/src/modules/core/components/Button'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { markOnboardingCompleted } from '@/src/modules/core/utils/onboarding'

type GlyphName = keyof typeof FontAwesome.glyphMap

const { width } = Dimensions.get('window')

const slides = [
    {
        id: 'workout',
        icon: 'plus-square' as GlyphName,
        titleKey: 'onboardingWorkoutTitle' as const,
        descKey: 'onboardingWorkoutDesc' as const,
    },
    {
        id: 'exercises',
        icon: 'book' as GlyphName,
        titleKey: 'onboardingExercisesTitle' as const,
        descKey: 'onboardingExercisesDesc' as const,
    },
    {
        id: 'sync',
        icon: 'cloud' as GlyphName,
        titleKey: 'onboardingSyncTitle' as const,
        descKey: 'onboardingSyncDesc' as const,
    },
]

export default function OnboardingScreen() {
    const router = useRouter()
    const { t } = useTranslation()
    const { theme } = useTheme()
    const insets = useSafeAreaInsets()
    const [currentIndex, setCurrentIndex] = useState(0)
    const flatListRef = useRef<FlatList>(null)

    const isLastSlide = currentIndex === slides.length - 1

    const complete = useCallback(async () => {
        await markOnboardingCompleted()
        router.replace('/(tabs)/workout')
    }, [router])

    const handleSkip = useCallback(() => {
        complete()
    }, [complete])

    const handleNext = useCallback(() => {
        if (isLastSlide) {
            complete()
        } else {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true })
        }
    }, [currentIndex, isLastSlide, complete])

    const onMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const page = Math.round(e.nativeEvent.contentOffset.x / width)
        setCurrentIndex(page)
    }, [])

    const renderSlide = useCallback(
        ({ item }: { item: (typeof slides)[number] }) => (
            <View style={styles.slide}>
                <View style={[styles.iconCircle, { backgroundColor: theme.surfaceMuted }]}>
                    <FontAwesome name={item.icon} size={56} color={theme.primary} />
                </View>
                <Typography.Title style={styles.title}>{t(item.titleKey)}</Typography.Title>
                <Typography.Body style={[styles.desc, { color: theme.textSecondary }]}>
                    {t(item.descKey)}
                </Typography.Body>
            </View>
        ),
        [theme, t]
    )

    const keyExtractor = useCallback((item: (typeof slides)[number]) => item.id, [])

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <TouchableOpacity
                onPress={handleSkip}
                style={[styles.skipButton, { top: insets.top + Spacing.sm }]}
                accessibilityRole="button"
                accessibilityLabel={t('onboardingSkip')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Typography.Body style={{ color: theme.primary, fontWeight: FontWeight.semibold }}>
                    {t('onboardingSkip')}
                </Typography.Body>
            </TouchableOpacity>

            <FlatList
                ref={flatListRef}
                data={slides}
                renderItem={renderSlide}
                keyExtractor={keyExtractor}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onMomentumScrollEnd={onMomentumScrollEnd}
                scrollEventThrottle={16}
            />

            <View style={styles.footer}>
                <View style={styles.dots}>
                    {slides.map((slide, index) => (
                        <View
                            key={slide.id}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: index === currentIndex ? theme.primary : theme.border,
                                    width: index === currentIndex ? 10 : 8,
                                    height: index === currentIndex ? 10 : 8,
                                },
                            ]}
                        />
                    ))}
                </View>

                <Button
                    label={t(isLastSlide ? 'onboardingGetStarted' : 'onboardingNext')}
                    onPress={handleNext}
                    style={styles.nextButton}
                />
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    skipButton: {
        position: 'absolute',
        right: Spacing.md,
        zIndex: 10,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
    },
    slide: {
        width,
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xl2,
    },
    title: {
        textAlign: 'center',
        marginBottom: Spacing.md,
    },
    desc: {
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: Spacing.md,
    },
    footer: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.xl2,
        gap: Spacing.lg,
        alignItems: 'center',
    },
    dots: {
        flexDirection: 'row',
        gap: Spacing.sm,
        alignItems: 'center',
    },
    dot: {
        borderRadius: Radius.pill,
    },
    nextButton: {
        width: '100%',
    },
})
