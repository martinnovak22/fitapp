import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard, Modal, Platform, Pressable, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontSize, FontWeight } from '@/src/constants/Typography'
import { Button } from '@/src/modules/core/components/Button'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { useTimer } from '../TimerProvider'
import { clampCountdown, type TimerMode } from '../timerCore'

type Props = {
    visible: boolean
    onClose: () => void
}

// Fixed, sensible defaults (seconds). Tune later if needed.
const PRESETS_SECONDS = [30, 60, 90, 120, 180]
const DEFAULT_PRESET = 60

const presetLabel = (seconds: number): string => (seconds % 60 === 0 ? `${seconds / 60}m` : `${seconds}s`)

const parseField = (value: string): number => {
    const n = parseInt(value, 10)
    return Number.isFinite(n) && n > 0 ? n : 0
}

export const TimerSetupModal: React.FC<Props> = ({ visible, onClose }) => {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const insets = useSafeAreaInsets()
    const { startStopwatch, startCountdown } = useTimer()

    const [mode, setMode] = useState<TimerMode>('countdown')
    const [selectedPreset, setSelectedPreset] = useState<number | null>(DEFAULT_PRESET)
    const [customMinutes, setCustomMinutes] = useState('')
    const [customSeconds, setCustomSeconds] = useState('')

    // Reset to defaults each time the modal opens so a previous run's choices
    // (e.g. a custom value already started and finished) never linger.
    useEffect(() => {
        if (!visible) return
        setMode('countdown')
        setSelectedPreset(DEFAULT_PRESET)
        setCustomMinutes('')
        setCustomSeconds('')
    }, [visible])

    // Lift the sheet above the keyboard for the custom-duration inputs, matching
    // the keyboard handling used by LogSetModal elsewhere in the app.
    const keyboardInset = useSharedValue(0)
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
        const showSub = Keyboard.addListener(showEvent, (event) => {
            const platformOffset = Platform.OS === 'ios' ? 10 : 24
            const inset = Math.max(0, event.endCoordinates.height - platformOffset)
            const duration = event.duration > 0 ? event.duration : Platform.OS === 'ios' ? 220 : 120
            keyboardInset.value = withTiming(inset, { duration })
        })
        const hideSub = Keyboard.addListener(hideEvent, (event) => {
            const duration = event.duration > 0 ? event.duration : Platform.OS === 'ios' ? 220 : 120
            keyboardInset.value = withTiming(0, { duration })
        })
        return () => {
            showSub.remove()
            hideSub.remove()
        }
    }, [keyboardInset])

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: -keyboardInset.value }],
    }))

    const hasCustom = customMinutes !== '' || customSeconds !== ''
    const customMs = (parseField(customMinutes) * 60 + parseField(customSeconds)) * 1000
    const effectiveMs = hasCustom ? customMs : selectedPreset !== null ? selectedPreset * 1000 : 0
    const canStartCountdown = effectiveMs > 0

    const handleStart = () => {
        Keyboard.dismiss()
        if (mode === 'stopwatch') {
            startStopwatch()
        } else {
            if (!canStartCountdown) return
            startCountdown(clampCountdown(effectiveMs))
        }
        onClose()
    }

    const selectPreset = (seconds: number) => {
        setSelectedPreset(seconds)
        setCustomMinutes('')
        setCustomSeconds('')
    }

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <Pressable style={[styles.backdrop, { backgroundColor: theme.overlayScrim }]} onPress={onClose}>
                <Animated.View style={sheetStyle}>
                    <Pressable
                        style={[
                            styles.sheet,
                            { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.lg },
                        ]}
                        onPress={() => {}}
                    >
                        <Typography.Subtitle style={styles.title}>{t('timer')}</Typography.Subtitle>

                        {/* Mode toggle */}
                        <View style={[styles.toggle, { backgroundColor: theme.surfaceMuted }]}>
                            {(['countdown', 'stopwatch'] as const).map((m) => {
                                const active = mode === m
                                return (
                                    <TouchableOpacity
                                        key={m}
                                        style={[styles.toggleOption, active && { backgroundColor: theme.primary }]}
                                        onPress={() => setMode(m)}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: active }}
                                    >
                                        <Typography.Body
                                            style={{
                                                color: active ? theme.onPrimary : theme.textSecondary,
                                                fontWeight: FontWeight.semibold,
                                            }}
                                        >
                                            {m === 'countdown' ? t('timerCountdown') : t('timerStopwatch')}
                                        </Typography.Body>
                                    </TouchableOpacity>
                                )
                            })}
                        </View>

                        {mode === 'countdown' && (
                            <>
                                <View style={styles.presets}>
                                    {PRESETS_SECONDS.map((seconds) => {
                                        const active = !hasCustom && selectedPreset === seconds
                                        return (
                                            <TouchableOpacity
                                                key={seconds}
                                                style={[
                                                    styles.chip,
                                                    { borderColor: active ? theme.primary : theme.border },
                                                    active && { backgroundColor: theme.primary },
                                                ]}
                                                onPress={() => selectPreset(seconds)}
                                                accessibilityRole={'button'}
                                                accessibilityState={{ selected: active }}
                                            >
                                                <Typography.Body
                                                    style={{ color: active ? theme.onPrimary : theme.text }}
                                                >
                                                    {presetLabel(seconds)}
                                                </Typography.Body>
                                            </TouchableOpacity>
                                        )
                                    })}
                                </View>

                                <Typography.Label style={styles.customLabel}>{t('timerCustom')}</Typography.Label>
                                <View style={styles.customRow}>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                color: theme.text,
                                                borderColor: theme.border,
                                                backgroundColor: theme.inputBackground,
                                            },
                                        ]}
                                        value={customMinutes}
                                        onChangeText={setCustomMinutes}
                                        keyboardType="number-pad"
                                        placeholder={t('minutes')}
                                        placeholderTextColor={theme.textSecondary}
                                        maxLength={2}
                                        accessibilityLabel={t('minutes')}
                                    />
                                    <Typography.Subtitle style={{ color: theme.textSecondary }}>:</Typography.Subtitle>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                color: theme.text,
                                                borderColor: theme.border,
                                                backgroundColor: theme.inputBackground,
                                            },
                                        ]}
                                        value={customSeconds}
                                        onChangeText={setCustomSeconds}
                                        keyboardType="number-pad"
                                        placeholder={t('seconds')}
                                        placeholderTextColor={theme.textSecondary}
                                        maxLength={2}
                                        accessibilityLabel={t('seconds')}
                                    />
                                </View>
                            </>
                        )}

                        <Button
                            label={t('timerStart')}
                            leftIcon="play"
                            onPress={handleStart}
                            disabled={mode === 'countdown' && !canStartCountdown}
                            style={styles.startButton}
                        />
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    )
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: Radius.lg,
        borderTopRightRadius: Radius.lg,
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    title: {
        textAlign: 'center',
    },
    toggle: {
        flexDirection: 'row',
        borderRadius: Radius.md,
        padding: Spacing.xs,
        gap: Spacing.xs,
    },
    toggleOption: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        borderRadius: Radius.sm,
    },
    presets: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
        justifyContent: 'center',
    },
    chip: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.pill,
        borderWidth: 1,
        alignItems: 'center',
    },
    customLabel: {
        textAlign: 'center',
    },
    customRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    input: {
        borderWidth: 1,
        borderRadius: Radius.sm,
        paddingVertical: Spacing.sm,
        textAlign: 'center',
        width: 80,
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
    },
    startButton: {
        marginTop: Spacing.sm,
    },
})
