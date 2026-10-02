import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useTranslation } from 'react-i18next'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { muscleGroupLabel } from '@/src/modules/exercises/taxonomyLabels'
import type { TemplateSummary } from '../templateSummary'

type Props = {
    summary: TemplateSummary
    onPress: () => void
    trailingIcon?: 'chevron-right' | 'play'
    disabled?: boolean
    accessibilityHint?: string
}

// One Workout Template in a list: name, Exercise count and the muscle groups it
// covers. Shared by the dashboard's Plans card and the start sheet.
export function TemplateRow({ summary, onPress, trailingIcon = 'chevron-right', disabled, accessibilityHint }: Props) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const { template, exerciseCount, muscleGroups } = summary
    const meta = [
        t('exercisesCount', { count: exerciseCount }),
        ...(muscleGroups.length > 0 ? [muscleGroups.map((group) => muscleGroupLabel(t, group)).join(', ')] : []),
    ].join(' • ')

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
            style={[styles.row, disabled && styles.disabled]}
            accessibilityRole={'button'}
            accessibilityLabel={`${template.name}, ${meta}`}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ disabled: !!disabled }}
        >
            <View style={[styles.icon, { backgroundColor: `${theme.primary}1A` }]}>
                <FontAwesome name={'list-alt'} size={16} color={theme.primary} />
            </View>
            <View style={styles.text}>
                <Typography.Body weight={'semibold'} numberOfLines={1}>
                    {template.name}
                </Typography.Body>
                <Typography.Meta color={'textSecondary'} numberOfLines={1}>
                    {meta}
                </Typography.Meta>
            </View>
            <FontAwesome
                name={trailingIcon}
                size={trailingIcon === 'play' ? 14 : 12}
                color={trailingIcon === 'play' ? theme.primary : theme.textSecondary}
            />
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.sm,
        minHeight: 56,
    },
    disabled: {
        opacity: 0.5,
    },
    icon: {
        width: 36,
        height: 36,
        borderRadius: Radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        flex: 1,
        minWidth: 0,
    },
})
