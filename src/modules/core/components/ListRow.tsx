import FontAwesome from '@expo/vector-icons/FontAwesome'
import type React from 'react'
import { type AccessibilityState, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import { useTheme } from '../hooks/useTheme'
import { Typography } from './Typography'

type GlyphName = keyof typeof FontAwesome.glyphMap

// Trailing accessory: a disclosure indicator (chevron) for rows that open the
// next level, a checkmark for the selected row of a choice list.
export type ListRowAccessory = 'chevron' | 'check' | 'none'

type ListRowProps = {
    label: string
    // Second line under the label.
    subtitle?: string
    // Current value, right-aligned before the accessory ("Primary muscle › Biceps").
    value?: string
    leadingIcon?: GlyphName
    // Custom leading element (e.g. a thumbnail); wins over leadingIcon.
    leading?: React.ReactNode
    // Custom trailing element (e.g. a switch); replaces value and accessory.
    trailing?: React.ReactNode
    accessory?: ListRowAccessory
    destructive?: boolean
    disabled?: boolean
    onPress?: () => void
    accessibilityHint?: string
    accessibilityRole?: 'button' | 'radio' | 'checkbox' | 'link'
    accessibilityState?: AccessibilityState
}

// One row of a ListSection: 48 dp minimum height, label on the leading edge,
// value + accessory on the trailing edge. Without onPress it renders as a
// static row.
export function ListRow({
    label,
    subtitle,
    value,
    leadingIcon,
    leading,
    trailing,
    accessory = 'none',
    destructive = false,
    disabled = false,
    onPress,
    accessibilityHint,
    accessibilityRole = 'button',
    accessibilityState,
}: ListRowProps) {
    const { theme } = useTheme()
    const labelColor = destructive ? 'error' : 'text'

    const content = (
        <>
            {leading ??
                (leadingIcon && (
                    <View style={styles.leadingIcon}>
                        <FontAwesome
                            name={leadingIcon}
                            size={18}
                            color={destructive ? theme.error : theme.textSecondary}
                        />
                    </View>
                ))}
            <View style={styles.text}>
                <Typography.Body color={labelColor} numberOfLines={1}>
                    {label}
                </Typography.Body>
                {subtitle && (
                    <Typography.Meta color={'textSecondary'} numberOfLines={1}>
                        {subtitle}
                    </Typography.Meta>
                )}
            </View>
            {trailing ?? (
                <>
                    {value !== undefined && (
                        <Typography.Body color={'textSecondary'} numberOfLines={1} style={styles.value}>
                            {value}
                        </Typography.Body>
                    )}
                    {accessory === 'chevron' && (
                        <FontAwesome name={'angle-right'} size={20} color={theme.textSecondary} />
                    )}
                    {accessory === 'check' && <FontAwesome name={'check'} size={16} color={theme.primary} />}
                </>
            )}
        </>
    )

    if (!onPress) {
        return <View style={styles.row}>{content}</View>
    }

    return (
        <TouchableOpacity
            style={[styles.row, disabled && styles.disabled]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.6}
            accessibilityRole={accessibilityRole}
            accessibilityLabel={value ? `${label}, ${value}` : label}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ disabled, ...accessibilityState }}
        >
            {content}
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm + Spacing.xs,
        minHeight: 48,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm + Spacing.xs / 2,
    },
    leadingIcon: {
        width: 24,
        alignItems: 'center',
    },
    text: {
        flex: 1,
        minWidth: 0,
        gap: Spacing.xs2,
    },
    value: {
        flexShrink: 1,
        maxWidth: '55%',
        textAlign: 'right',
    },
    disabled: {
        opacity: 0.5,
    },
})
