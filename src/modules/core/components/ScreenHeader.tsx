import { Spacing } from '@/src/constants/Spacing'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Button } from './Button'
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
                    <Button
                        label={rightAction.label}
                        onPress={rightAction.onPress}
                        disabled={rightAction.disabled}
                        size={'sm'}
                    />
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
})
