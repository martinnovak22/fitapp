import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard, StyleSheet, TextInput, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontSize, FontWeight } from '@/src/constants/Typography'
import { Button } from '@/src/modules/core/components/Button'
import { type Segment, SegmentedControl } from '@/src/modules/core/components/SegmentedControl'
import { Sheet } from '@/src/modules/core/components/Sheet'
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

const presetLabel = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const parseField = (value: string): number => {
    const n = parseInt(value, 10)
    return Number.isFinite(n) && n > 0 ? n : 0
}

export const TimerSetupModal: React.FC<Props> = ({ visible, onClose }) => {
    const { t } = useTranslation()
    const { theme } = useTheme()
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

    const modeSegments: Segment<TimerMode>[] = [
        { value: 'countdown', label: t('timerCountdown') },
        { value: 'stopwatch', label: t('timerStopwatch') },
    ]
    const presetSegments: Segment<string>[] = PRESETS_SECONDS.map((seconds) => ({
        value: String(seconds),
        label: presetLabel(seconds),
    }))

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={t('timer')}
            footer={
                <Button
                    label={t('timerStart')}
                    leftIcon={'play'}
                    onPress={handleStart}
                    disabled={mode === 'countdown' && !canStartCountdown}
                />
            }
        >
            <View style={styles.content}>
                <SegmentedControl
                    segments={modeSegments}
                    value={mode}
                    onChange={setMode}
                    accessibilityLabel={t('timer')}
                />

                {mode === 'countdown' && (
                    <>
                        <SegmentedControl
                            segments={presetSegments}
                            // No preset reads selected while a custom time is typed.
                            value={hasCustom || selectedPreset === null ? '' : String(selectedPreset)}
                            onChange={(value) => selectPreset(Number(value))}
                        />
                        <View style={styles.customRow}>
                            <Typography.Label style={styles.customLabel}>{t('timerCustom')}</Typography.Label>
                            <TextInput
                                style={[styles.input, { color: theme.text, backgroundColor: theme.inputBackground }]}
                                value={customMinutes}
                                onChangeText={setCustomMinutes}
                                keyboardType="number-pad"
                                placeholder={t('colMin')}
                                placeholderTextColor={theme.textSecondary}
                                selectionColor={theme.primary}
                                maxLength={2}
                                accessibilityLabel={t('minutes')}
                            />
                            <Typography.Subtitle color={'textSecondary'}>:</Typography.Subtitle>
                            <TextInput
                                style={[styles.input, { color: theme.text, backgroundColor: theme.inputBackground }]}
                                value={customSeconds}
                                onChangeText={setCustomSeconds}
                                keyboardType="number-pad"
                                placeholder={t('colSec')}
                                placeholderTextColor={theme.textSecondary}
                                selectionColor={theme.primary}
                                maxLength={2}
                                accessibilityLabel={t('seconds')}
                            />
                        </View>
                    </>
                )}
            </View>
        </Sheet>
    )
}

const styles = StyleSheet.create({
    content: {
        gap: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    customRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    customLabel: {
        flex: 1,
    },
    input: {
        borderRadius: Radius.sm,
        minHeight: 48,
        textAlign: 'center',
        width: 80,
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        fontVariant: ['tabular-nums'],
    },
})
