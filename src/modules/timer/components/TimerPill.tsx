import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Portal } from 'react-native-teleport'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontSize, FontWeight } from '@/src/constants/Typography'
import { Appear } from '@/src/modules/core/components/motion'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { useTimer } from '../TimerProvider'
import { displayMs, formatTimerDisplay } from '../timerCore'

// Mirror of TAB_BAR_BASE_HEIGHT in app/(tabs)/_layout.tsx — the pill floats just
// above the tab bar so it never hides behind it on the main screens.
const TAB_BAR_HEIGHT = 80
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 }

export const TimerPill: React.FC = () => {
    const { state, now, completionNonce, pauseTimer, resumeTimer, finishTimer, stopTimer } = useTimer()
    const { theme } = useTheme()
    const insets = useSafeAreaInsets()
    const { t } = useTranslation()
    const [expanded, setExpanded] = useState(false)

    // Flash the pill once each time a countdown completes in-foreground.
    const flash = useSharedValue(0)
    useEffect(() => {
        if (completionNonce === 0) return
        flash.value = withSequence(
            withTiming(1, { duration: 140 }),
            withTiming(0, { duration: 360 }),
            withTiming(1, { duration: 140 }),
            withTiming(0, { duration: 360 })
        )
    }, [completionNonce, flash])

    const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }))

    // Collapse whenever the timer goes away so it reopens fresh next time.
    useEffect(() => {
        if (!state) setExpanded(false)
    }, [state])

    if (!state) return null

    const isCountdown = state.mode === 'countdown'
    const isDone = state.status === 'done'
    const isPaused = state.status === 'paused'
    // A running stopwatch stops in two steps: first freeze at its final time
    // (finishTimer), then a confirming tap on the check removes it (stopTimer).
    // Countdowns remove immediately on stop, and any 'done' timer removes.
    const handleStopPress = state.mode === 'stopwatch' && !isDone ? finishTimer : stopTimer
    const label = formatTimerDisplay(displayMs(state, now), isCountdown && !isDone)
    const modeLabel = isDone ? t('timerDone') : isCountdown ? t('timerCountdown') : t('timerStopwatch')
    const bottom = insets.bottom + TAB_BAR_HEIGHT + Spacing.sm

    return (
        <Portal hostName="overlay">
            <Appear variant="down" style={[styles.anchor, { bottom }]}>
                {expanded ? (
                    <View style={[styles.expanded, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Animated.View
                            pointerEvents="none"
                            style={[styles.flash, { backgroundColor: theme.primary }, flashStyle]}
                        />
                        <TouchableOpacity
                            style={styles.expandedHeader}
                            onPress={() => setExpanded(false)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={t('collapse')}
                        >
                            <Typography.Label color={isDone ? 'primary' : 'textSecondary'}>
                                {modeLabel}
                            </Typography.Label>
                            <FontAwesome name="chevron-down" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>

                        <Typography.Title style={[styles.bigTime, { color: isDone ? theme.primary : theme.text }]}>
                            {label}
                        </Typography.Title>

                        <View style={styles.controls}>
                            {!isDone && (
                                <TouchableOpacity
                                    onPress={isPaused ? resumeTimer : pauseTimer}
                                    style={[styles.controlButton, { backgroundColor: theme.surfaceMuted }]}
                                    accessibilityRole="button"
                                    accessibilityLabel={isPaused ? t('resume') : t('pause')}
                                >
                                    <FontAwesome name={isPaused ? 'play' : 'pause'} size={18} color={theme.text} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                onPress={handleStopPress}
                                style={[
                                    styles.controlButton,
                                    { backgroundColor: isDone ? theme.primary : theme.error },
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={isDone ? t('timerDone') : t('stop')}
                            >
                                <FontAwesome name={isDone ? 'check' : 'stop'} size={18} color={theme.onPrimary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setExpanded(true)}
                        style={[styles.pill, { backgroundColor: theme.card, borderColor: theme.border }]}
                        accessibilityRole="button"
                        accessibilityLabel={`${modeLabel} ${label}`}
                        accessibilityHint={t('timerExpandHint')}
                    >
                        <Animated.View
                            pointerEvents="none"
                            style={[styles.flash, { backgroundColor: theme.primary }, flashStyle]}
                        />
                        <FontAwesome
                            name={isCountdown ? 'hourglass-half' : 'clock-o'}
                            size={16}
                            color={theme.primary}
                        />
                        <Typography.Subtitle style={[styles.pillTime, { color: theme.text }]}>
                            {label}
                        </Typography.Subtitle>
                        {isPaused && <FontAwesome name="pause" size={12} color={theme.textSecondary} />}
                        <View style={[styles.pillDivider, { backgroundColor: theme.border }]} />
                        <TouchableOpacity
                            onPress={handleStopPress}
                            hitSlop={HIT_SLOP}
                            accessibilityRole="button"
                            accessibilityLabel={isDone ? t('timerDone') : t('stop')}
                        >
                            <FontAwesome
                                name={isDone ? 'check' : 'stop'}
                                size={16}
                                color={isDone ? theme.primary : theme.error}
                            />
                        </TouchableOpacity>
                    </TouchableOpacity>
                )}
            </Appear>
        </Portal>
    )
}

// Monospaced digits keep the time from jittering as numbers change width.
const MONO = 'SpaceMono'

const styles = StyleSheet.create({
    anchor: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.pill,
        borderWidth: 1,
        overflow: 'hidden',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.27,
        shadowRadius: 4.65,
    },
    pillTime: {
        fontFamily: MONO,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
    },
    pillDivider: {
        width: 1,
        height: 18,
        marginHorizontal: Spacing.xs,
    },
    expanded: {
        width: 240,
        borderRadius: Radius.lg,
        borderWidth: 1,
        padding: Spacing.md,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    expandedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bigTime: {
        fontFamily: MONO,
        textAlign: 'center',
        marginVertical: Spacing.sm,
        fontSize: 44,
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.md,
    },
    controlButton: {
        width: 52,
        height: 52,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    flash: {
        ...StyleSheet.absoluteFillObject,
    },
})
