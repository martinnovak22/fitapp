import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Duration } from '@/src/constants/Motion'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { Button } from '@/src/modules/core/components/Button'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { formatHourMinute, formatLocalDateYYYYMMDD, formatLocalizedDate } from '@/src/utils/dateTime'
import { DateTimeField } from './DateTimeField'

// Distance (px) the sheet slides up on entry and back down on exit, matching
// LogSetModal so both sheets share one motion language.
const SHEET_SLIDE_OFFSET = 32

type Props = {
    visible: boolean
    language: string
    /** Stored as `YYYY-MM-DD`. */
    date: string
    /** Stored as `HH:mm`. */
    startTime: string
    /** Stored as `HH:mm`; empty string means "not specified". */
    endTime: string
    onChangeDate: (value: string) => void
    onChangeStartTime: (value: string) => void
    onChangeEndTime: (value: string) => void
    onSave: () => void
    onClose: () => void
    isSaving: boolean
}

const pad = (value: number) => String(value).padStart(2, '0')

const timeStringFromDate = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

// Combine the stored date + time strings into a single Date the native picker
// can seed from. Falls back to "now" / midnight when a part is missing or junk.
const dateFromParts = (dateStr: string, timeStr: string): Date => {
    const parsed = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date()
    const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed
    if (timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number)
        if (!Number.isNaN(hours) && !Number.isNaN(minutes)) base.setHours(hours, minutes, 0, 0)
    }
    return base
}

export const EditTimingModal = ({
    visible,
    language,
    date,
    startTime,
    endTime,
    onChangeDate,
    onChangeStartTime,
    onChangeEndTime,
    onSave,
    onClose,
    isSaving,
}: Props) => {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const insets = useSafeAreaInsets()

    const [isMounted, setIsMounted] = useState(visible)
    const wasVisibleRef = useRef(false)

    const sheetOpacity = useSharedValue(0)
    const sheetOffset = useSharedValue(SHEET_SLIDE_OFFSET)
    const backdropOpacity = useSharedValue(0)

    const handleCloseComplete = useCallback(() => {
        setIsMounted(false)
        sheetOffset.value = SHEET_SLIDE_OFFSET
    }, [sheetOffset])

    useEffect(() => {
        if (visible) {
            setIsMounted(true)
            if (!wasVisibleRef.current) {
                wasVisibleRef.current = true
                sheetOpacity.value = 0
                sheetOffset.value = SHEET_SLIDE_OFFSET
                backdropOpacity.value = 0
                sheetOpacity.value = withTiming(1, { duration: Duration.fast })
                sheetOffset.value = withTiming(0, { duration: Duration.base })
                backdropOpacity.value = withTiming(1, { duration: Duration.base })
            }
            return
        }
        if (wasVisibleRef.current) {
            wasVisibleRef.current = false
            backdropOpacity.value = withTiming(0, { duration: Duration.base })
            sheetOpacity.value = withTiming(0, { duration: Duration.base })
            sheetOffset.value = withTiming(SHEET_SLIDE_OFFSET, { duration: Duration.base }, (finished) => {
                if (finished) runOnJS(handleCloseComplete)()
            })
        }
    }, [backdropOpacity, handleCloseComplete, sheetOffset, sheetOpacity, visible])

    const sheetStyle = useAnimatedStyle(() => ({
        opacity: sheetOpacity.value,
        transform: [{ translateY: sheetOffset.value }],
    }))
    const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }))

    if (!isMounted) return null

    const dateValue = dateFromParts(date, '00:00')
    const startValue = dateFromParts(date, startTime || '00:00')
    const endValue = dateFromParts(date, endTime || startTime || '00:00')

    const dateDisplay = date
        ? formatLocalizedDate(`${date}T00:00:00`, language, { year: 'numeric', month: 'short', day: 'numeric' }, true)
        : t('notSpecified')
    const startDisplay = startTime ? formatHourMinute(startValue) : t('notSpecified')
    const endDisplay = endTime ? formatHourMinute(endValue) : t('notSpecified')

    return (
        <Modal animationType={'none'} transparent visible={isMounted} onRequestClose={onClose}>
            <View style={styles.root}>
                <Animated.View style={[styles.backdrop, { backgroundColor: theme.overlayBackdrop }, backdropStyle]}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                </Animated.View>

                <Animated.View
                    style={[
                        styles.sheet,
                        { backgroundColor: theme.surface, paddingBottom: Spacing.lg + insets.bottom },
                        sheetStyle,
                    ]}
                >
                    <View style={styles.grabberWrap}>
                        <View style={[styles.grabber, { backgroundColor: `${theme.textSecondary}66` }]} />
                    </View>

                    <Typography.Title>{t('editTime')}</Typography.Title>

                    <View style={styles.fields}>
                        <DateTimeField
                            label={t('workoutDate')}
                            mode={'date'}
                            value={dateValue}
                            displayValue={dateDisplay}
                            onChange={(picked) => onChangeDate(formatLocalDateYYYYMMDD(picked))}
                        />
                        <DateTimeField
                            label={t('startTime')}
                            mode={'time'}
                            value={startValue}
                            displayValue={startDisplay}
                            onChange={(picked) => onChangeStartTime(timeStringFromDate(picked))}
                        />
                        <DateTimeField
                            label={t('endTime')}
                            mode={'time'}
                            value={endValue}
                            displayValue={endDisplay}
                            onChange={(picked) => onChangeEndTime(timeStringFromDate(picked))}
                        />
                    </View>

                    <View style={styles.actions}>
                        <Button label={t('cancel')} variant={'outline'} onPress={onClose} />
                        <Button
                            label={isSaving ? t('saving') : t('saveChanges')}
                            onPress={onSave}
                            disabled={isSaving}
                        />
                    </View>
                </Animated.View>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    sheet: {
        width: '100%',
        borderTopLeftRadius: Radius.lg,
        borderTopRightRadius: Radius.lg,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
    },
    grabberWrap: {
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    grabber: {
        width: 42,
        height: 4,
        borderRadius: Radius.pill,
    },
    fields: {
        gap: Spacing.md,
        marginTop: Spacing.md,
    },
    actions: {
        marginTop: Spacing.lg,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: Spacing.sm,
    },
})
