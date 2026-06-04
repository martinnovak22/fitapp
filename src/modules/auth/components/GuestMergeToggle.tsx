import FontAwesome from '@expo/vector-icons/FontAwesome'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'

const layoutTransition = LinearTransition.duration(220)

type GuestMergeToggleProps = {
    visible: boolean
    checked: boolean
    onToggle: () => void
}

// The "merge my guest data on sign-in" checkbox row, shown only to a guest who
// has local data and is signing in. Owns its visibility branch and the checked
// glyph/colour swap.
export function GuestMergeToggle({ visible, checked, onToggle }: GuestMergeToggleProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()

    if (!visible) return null

    return (
        <Animated.View layout={layoutTransition} entering={FadeInDown.duration(160)} style={styles.hintArea}>
            <Pressable
                style={[styles.migrationRow, { borderColor: theme.border }]}
                onPress={onToggle}
                accessibilityRole={'checkbox'}
                accessibilityLabel={t('mergeGuestDataLabel')}
                accessibilityState={{ checked }}
            >
                <FontAwesome
                    name={checked ? 'check-square-o' : 'square-o'}
                    size={18}
                    color={checked ? theme.primary : theme.textSecondary}
                />
                <View style={styles.migrationTextWrap}>
                    <Typography.Meta style={{ color: theme.text }}>{t('mergeGuestDataLabel')}</Typography.Meta>
                    <Typography.Meta style={{ color: theme.textSecondary }}>{t('mergeGuestDataHint')}</Typography.Meta>
                </View>
            </Pressable>
        </Animated.View>
    )
}

const styles = StyleSheet.create({
    hintArea: {
        marginBottom: Spacing.sm,
    },
    migrationRow: {
        borderWidth: 1,
        borderRadius: Radius.sm,
        padding: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
    },
    migrationTextWrap: {
        flex: 1,
    },
})
