import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { useTheme } from '../hooks/useTheme'
import { computeMenuPosition, type Rect } from './menuPosition'
import { Typography } from './Typography'

type GlyphName = keyof typeof FontAwesome.glyphMap

export type OverflowMenuItem = {
    key: string
    label: string
    icon?: GlyphName
    destructive?: boolean
    disabled?: boolean
    onPress: () => void
}

type OverflowMenuProps = {
    items: readonly OverflowMenuItem[]
    // 'topBar' for the ⋯ in a screen header; 'anchor' opens below the button.
    placement?: 'topBar' | 'anchor'
    accessibilityLabel?: string
}

const MENU_WIDTH = 220
const ITEM_HEIGHT = 48
const MENU_PADDING = Spacing.xs

// The ⋯ button on the trailing edge of a top app bar, opening a popover menu
// of the screen's secondary actions (delete, edit timing, import/export). The
// primary action stays a visible button next to it.
export function OverflowMenu({ items, placement = 'anchor', accessibilityLabel }: OverflowMenuProps) {
    const { t } = useTranslation()
    const { theme, isDark } = useTheme()
    const window = useWindowDimensions()
    const insets = useSafeAreaInsets()
    const anchorRef = useRef<View>(null)
    const [anchor, setAnchor] = useState<Rect | null>(null)

    const open = () => {
        // A top-bar button lives in the native toolbar, where measureInWindow
        // reports toolbar-local coordinates. Open from the trailing top corner
        // instead, over the bar, as the native Android overflow menu does.
        if (placement === 'topBar') {
            setAnchor({ x: window.width, y: insets.top, width: 0, height: 0 })
            return
        }
        anchorRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }))
    }
    const close = () => setAnchor(null)

    const select = (item: OverflowMenuItem) => {
        close()
        item.onPress()
    }

    const position = anchor
        ? computeMenuPosition(anchor, window, {
              width: MENU_WIDTH,
              height: items.length * ITEM_HEIGHT + MENU_PADDING * 2,
          })
        : null

    return (
        <>
            <View ref={anchorRef} collapsable={false}>
                <TouchableOpacity
                    onPress={open}
                    style={styles.button}
                    accessibilityRole={'button'}
                    accessibilityLabel={accessibilityLabel ?? t('moreActions')}
                >
                    <FontAwesome name={'ellipsis-v'} size={20} color={theme.text} />
                </TouchableOpacity>
            </View>
            <Modal
                visible={anchor !== null}
                transparent
                animationType={'fade'}
                onRequestClose={close}
                statusBarTranslucent
            >
                <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t('close')} />
                {position && (
                    <View
                        style={[
                            styles.menu,
                            {
                                top: position.top,
                                left: position.left,
                                backgroundColor: isDark ? theme.surface : theme.card,
                                borderColor: theme.hairline,
                            },
                        ]}
                        accessibilityRole={'menu'}
                    >
                        {items.map((item) => (
                            <TouchableOpacity
                                key={item.key}
                                style={[styles.item, item.disabled && styles.disabled]}
                                onPress={() => select(item)}
                                disabled={item.disabled}
                                accessibilityRole={'menuitem'}
                                accessibilityState={{ disabled: item.disabled }}
                            >
                                {item.icon && (
                                    <FontAwesome
                                        name={item.icon}
                                        size={16}
                                        color={item.destructive ? theme.error : theme.textSecondary}
                                        style={styles.icon}
                                    />
                                )}
                                <Typography.Body color={item.destructive ? 'error' : 'text'} numberOfLines={1}>
                                    {item.label}
                                </Typography.Body>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </Modal>
        </>
    )
}

const styles = StyleSheet.create({
    button: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menu: {
        position: 'absolute',
        width: MENU_WIDTH,
        borderRadius: Radius.sm,
        borderWidth: StyleSheet.hairlineWidth,
        paddingVertical: MENU_PADDING,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm + Spacing.xs,
        height: ITEM_HEIGHT,
        paddingHorizontal: Spacing.md,
    },
    icon: {
        width: 18,
        textAlign: 'center',
    },
    disabled: {
        opacity: 0.4,
    },
})
