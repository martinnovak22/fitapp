import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'

type Props = {
    label: string
    mode: 'date' | 'time'
    /** Picker value. Also seeds the wheel when the displayed value is empty. */
    value: Date
    /** Pre-formatted text shown in the field (caller owns locale formatting). */
    displayValue: string
    onChange: (date: Date) => void
    accessibilityLabel?: string
}

/**
 * A tappable field backed by the native date/time picker. Android opens the
 * platform dialog imperatively; iOS reveals an inline spinner below the field
 * (toggled by tapping again), keeping everything inside the parent sheet.
 */
export const DateTimeField = ({ label, mode, value, displayValue, onChange, accessibilityLabel }: Props) => {
    const { theme, isDark } = useTheme()
    const [iosPickerVisible, setIosPickerVisible] = useState(false)

    const handlePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
        if (Platform.OS === 'android') {
            // Android dialog dismisses itself; only commit when the user confirms.
            if (event.type === 'set' && selected) onChange(selected)
            return
        }
        // iOS spinner streams 'set' events as the wheel moves.
        if (selected) onChange(selected)
    }

    const openPicker = () => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({ value, mode, is24Hour: true, onChange: handlePickerChange })
            return
        }
        setIosPickerVisible((prev) => !prev)
    }

    const active = Platform.OS === 'ios' && iosPickerVisible

    return (
        <View style={styles.container}>
            <Typography.Label color={'text'}>{label}</Typography.Label>
            <TouchableOpacity
                onPress={openPicker}
                accessibilityRole={'button'}
                accessibilityLabel={accessibilityLabel ?? label}
                style={[
                    styles.field,
                    {
                        backgroundColor: theme.inputBackground,
                        borderColor: active ? theme.primary : theme.border,
                    },
                ]}
            >
                <Typography.Body>{displayValue}</Typography.Body>
            </TouchableOpacity>
            {active && (
                <DateTimePicker
                    value={value}
                    mode={mode}
                    display={'spinner'}
                    onChange={handlePickerChange}
                    themeVariant={isDark ? 'dark' : 'light'}
                    style={styles.iosPicker}
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        gap: Spacing.sm,
    },
    field: {
        padding: Spacing.md,
        borderRadius: Radius.sm,
        borderWidth: 1,
    },
    iosPicker: {
        alignSelf: 'stretch',
    },
})
