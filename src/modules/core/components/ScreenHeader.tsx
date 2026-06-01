import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Typography } from './Typography'
import { useTheme } from '../hooks/useTheme'

interface ScreenHeaderProps {
    title: string
    onDelete?: () => void
    rightAction?: {
        label: string
        onPress: () => void
        disabled?: boolean
    }
}

export const ScreenHeader = ({ title, onDelete, rightAction }: ScreenHeaderProps) => {
    const { theme } = useTheme()
    const { t } = useTranslation()
    return (
        <View style={styles.container}>
            <Typography.Title style={styles.title} numberOfLines={1}>
                {title}
            </Typography.Title>

            <View style={styles.actions}>
                {rightAction && (
                    <TouchableOpacity
                        onPress={rightAction.onPress}
                        disabled={rightAction.disabled}
                        style={[
                            styles.textButton,
                            { backgroundColor: theme.primary },
                            rightAction.disabled && styles.disabledAction,
                        ]}
                        accessibilityRole={'button'}
                        accessibilityLabel={rightAction.label}
                        accessibilityState={rightAction.disabled ? { disabled: true } : undefined}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                        <Typography.Body weight="bold" color="onPrimary">
                            {rightAction.label}
                        </Typography.Body>
                    </TouchableOpacity>
                )}

                {onDelete && (
                    <TouchableOpacity
                        onPress={onDelete}
                        style={styles.iconButton}
                        accessibilityRole={'button'}
                        accessibilityLabel={t('delete')}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                        <FontAwesome name={'trash'} size={24} color={theme.error} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.md,
        gap: Spacing.md,
    },
    title: {
        flex: 1,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    iconButton: {
        padding: Spacing.xs,
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textButton: {
        paddingVertical: 6,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.sm,
        minHeight: 44,
        justifyContent: 'center',
    },
    disabledAction: {
        opacity: 0.6,
    },
})
