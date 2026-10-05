import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Keyboard,
    Modal,
    Platform,
    type StyleProp,
    StyleSheet,
    TouchableOpacity,
    View,
    type ViewStyle,
} from 'react-native'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Duration } from '@/src/constants/Motion'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { useTheme } from '../hooks/useTheme'
import { Typography } from './Typography'

// Distance (px) the sheet slides up on entry and back down on exit — the one
// motion language every bottom sheet in the app shares.
export const SHEET_SLIDE_OFFSET = 32

type SheetProps = {
    visible: boolean
    onClose: () => void
    title?: string
    // Rendered on the trailing edge of the title row (e.g. a Done button).
    headerAction?: React.ReactNode
    children: React.ReactNode
    // Pinned under the scrollable content, above the bottom inset.
    footer?: React.ReactNode
    // Fill most of the screen even when the content is short (long lists with
    // search, so the sheet doesn't jump as results filter).
    tall?: boolean
    contentStyle?: StyleProp<ViewStyle>
}

// Modal bottom sheet: backdrop + grabber + title, sliding up from the bottom
// edge and lifting above the keyboard. Only one is shown at a time (HIG
// Sheets): open the next one after closing this, never on top of it.
export function Sheet({ visible, onClose, title, headerAction, children, footer, tall, contentStyle }: SheetProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const insets = useSafeAreaInsets()

    const [isMounted, setIsMounted] = useState(visible)
    const wasVisibleRef = useRef(false)
    const sheetOpacity = useSharedValue(0)
    const sheetOffset = useSharedValue(SHEET_SLIDE_OFFSET)
    const backdropOpacity = useSharedValue(0)
    const keyboardInset = useSharedValue(0)

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
            Keyboard.dismiss()
            backdropOpacity.value = withTiming(0, { duration: Duration.base })
            sheetOpacity.value = withTiming(0, { duration: Duration.base })
            sheetOffset.value = withTiming(SHEET_SLIDE_OFFSET, { duration: Duration.base }, (finished) => {
                if (finished) runOnJS(handleCloseComplete)()
            })
        }
    }, [backdropOpacity, handleCloseComplete, sheetOffset, sheetOpacity, visible])

    useEffect(() => {
        if (!isMounted) return
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
        const showSub = Keyboard.addListener(showEvent, (event) => {
            const duration = event.duration > 0 ? event.duration : Duration.fast
            // The bottom inset padding already clears the nav bar, so lift only the rest.
            keyboardInset.value = withTiming(Math.max(0, event.endCoordinates.height - insets.bottom), { duration })
        })
        const hideSub = Keyboard.addListener(hideEvent, (event) => {
            const duration = event.duration > 0 ? event.duration : Duration.fast
            keyboardInset.value = withTiming(0, { duration })
        })
        return () => {
            showSub.remove()
            hideSub.remove()
        }
    }, [insets.bottom, isMounted, keyboardInset])

    const sheetStyle = useAnimatedStyle(() => ({
        opacity: sheetOpacity.value,
        transform: [{ translateY: sheetOffset.value }],
        marginBottom: keyboardInset.value,
    }))
    const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }))

    if (!isMounted) return null

    return (
        <Modal animationType={'none'} transparent visible={isMounted} onRequestClose={onClose} statusBarTranslucent>
            <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
                <Animated.View style={[styles.backdrop, { backgroundColor: theme.overlayScrimLight }, backdropStyle]}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={onClose}
                        accessibilityRole={'button'}
                        accessibilityLabel={t('close')}
                    />
                </Animated.View>
                <Animated.View
                    style={[
                        styles.sheet,
                        tall && styles.tall,
                        { backgroundColor: theme.surface, paddingBottom: insets.bottom + Spacing.md },
                        sheetStyle,
                    ]}
                >
                    <View style={styles.grabberWrap}>
                        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
                    </View>
                    {(title || headerAction) && (
                        <View style={styles.header}>
                            <Typography.Subtitle style={styles.title} numberOfLines={1}>
                                {title}
                            </Typography.Subtitle>
                            {headerAction}
                        </View>
                    )}
                    <View style={[styles.content, contentStyle]}>{children}</View>
                    {footer}
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
        borderTopLeftRadius: Radius.lg,
        borderTopRightRadius: Radius.lg,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.xs,
        gap: Spacing.sm,
        maxHeight: '100%',
    },
    tall: {
        height: '100%',
    },
    grabberWrap: {
        alignItems: 'center',
        paddingVertical: Spacing.xs,
    },
    grabber: {
        width: 32,
        height: 4,
        borderRadius: Radius.pill,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        minHeight: 48,
    },
    title: {
        flex: 1,
    },
    content: {
        flexShrink: 1,
        minHeight: 0,
    },
})
