import { StyleSheet, TouchableOpacity } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'

type Props = {
    label: string
    // Defaults to the label; set it when the label leans on its section heading.
    accessibilityLabel?: string
    selected: boolean
    onPress: () => void
    disabled?: boolean
    // checkbox for multi-select chips, radio for single-select ones.
    role: 'radio' | 'checkbox'
}

// One selectable option of the Muscle or Equipment pickers.
export function TaxonomyChip({ label, accessibilityLabel, selected, onPress, disabled, role }: Props) {
    const { theme } = useTheme()
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
            style={[
                styles.chip,
                { borderColor: theme.border },
                selected && { backgroundColor: theme.primary, borderColor: theme.primary },
                disabled && styles.disabled,
            ]}
            accessibilityRole={role}
            accessibilityState={{ checked: selected, disabled: !!disabled }}
            accessibilityLabel={accessibilityLabel ?? label}
        >
            <Typography.Meta
                size={'sm'}
                weight={selected ? 'semibold' : 'medium'}
                style={{ color: selected ? theme.onPrimary : theme.text }}
            >
                {label}
            </Typography.Meta>
        </TouchableOpacity>
    )
}

// A compact pill: smaller than a Button, larger than a badge.
const CHIP_PADDING_VERTICAL = Spacing.xs + Spacing.xs2
const CHIP_PADDING_HORIZONTAL = Spacing.md - Spacing.xs

const styles = StyleSheet.create({
    chip: {
        paddingVertical: CHIP_PADDING_VERTICAL,
        paddingHorizontal: CHIP_PADDING_HORIZONTAL,
        borderRadius: Radius.pill,
        borderWidth: 1,
    },
    disabled: {
        opacity: 0.35,
    },
})
