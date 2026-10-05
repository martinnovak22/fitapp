import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { useTheme } from '../hooks/useTheme'
import { Typography } from './Typography'

export type Segment<T extends string> = {
    value: T
    label: string
}

type SegmentedControlProps<T extends string> = {
    segments: readonly Segment<T>[]
    value: T
    onChange: (value: T) => void
    accessibilityLabel?: string
    disabled?: boolean
}

// Two to five mutually exclusive options shown side by side (M3 segmented
// button / HIG segmented control). More than five options belong in a
// SelectSheet instead. Switching is instant: no motion on a frequent control.
export function SegmentedControl<T extends string>({
    segments,
    value,
    onChange,
    accessibilityLabel,
    disabled = false,
}: SegmentedControlProps<T>) {
    const { theme, isDark } = useTheme()

    return (
        <View
            style={[styles.track, { backgroundColor: theme.inputBackground }, disabled && styles.disabled]}
            accessibilityRole={'radiogroup'}
            accessibilityLabel={accessibilityLabel}
        >
            {segments.map((segment) => {
                const selected = segment.value === value
                return (
                    <TouchableOpacity
                        key={segment.value}
                        style={[
                            styles.segment,
                            selected && [
                                // A translucent dark-mode fill would show the shadow through it.
                                !isDark && styles.selected,
                                { backgroundColor: theme.segmentActive },
                            ],
                        ]}
                        onPress={() => !selected && onChange(segment.value)}
                        disabled={disabled}
                        activeOpacity={0.7}
                        accessibilityRole={'radio'}
                        accessibilityState={{ selected, checked: selected, disabled }}
                        accessibilityLabel={segment.label}
                    >
                        <Typography.Label
                            color={selected ? 'text' : 'textSecondary'}
                            weight={selected ? 'semibold' : 'medium'}
                            numberOfLines={1}
                        >
                            {segment.label}
                        </Typography.Label>
                    </TouchableOpacity>
                )
            })}
        </View>
    )
}

const styles = StyleSheet.create({
    track: {
        flexDirection: 'row',
        borderRadius: Radius.sm + 2,
        padding: 3,
        minHeight: 48,
    },
    segment: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.sm,
    },
    selected: {
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
    },
    disabled: {
        opacity: 0.5,
    },
})
