import FontAwesome from '@expo/vector-icons/FontAwesome'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { useTheme } from '../hooks/useTheme'
import { Typography } from './Typography'

type FilterChipProps = {
    // The facet's name, or the chosen value while it filters.
    label: string
    active: boolean
    onPress: () => void
    accessibilityLabel?: string
}

// A filter that opens its choices (M3 filter chip with a dropdown caret).
// Active filters take the accent tint and border: selection is one of the
// accent's jobs. The label stays text-coloured, which the tint keeps at 4.5:1.
export function FilterChip({ label, active, onPress, accessibilityLabel }: FilterChipProps) {
    const { theme } = useTheme()
    return (
        <TouchableOpacity
            onPress={onPress}
            style={[
                styles.chip,
                active
                    ? { backgroundColor: theme.primaryTintStrong, borderColor: theme.primary }
                    : { borderColor: theme.border },
            ]}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole={'button'}
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityState={{ selected: active }}
        >
            <Typography.Label color={'text'} numberOfLines={1}>
                {label}
            </Typography.Label>
            <FontAwesome name={'caret-down'} size={12} color={active ? theme.primary : theme.textSecondary} />
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs + Spacing.xs2,
        minHeight: 36,
        paddingHorizontal: Spacing.sm + Spacing.xs,
        borderRadius: Radius.pill,
        borderWidth: 1,
        maxWidth: '50%',
    },
})
