import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useTranslation } from 'react-i18next'
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontSize } from '@/src/constants/Typography'
import { useTheme } from '../hooks/useTheme'

type SearchFieldProps = {
    value: string
    onChangeText: (value: string) => void
    placeholder?: string
}

// The one search input: magnifier, text, and a clear button once there is a
// query. 44 dp tall, on the input fill.
export function SearchField({ value, onChangeText, placeholder }: SearchFieldProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const label = placeholder ?? t('search')
    return (
        <View style={[styles.field, { backgroundColor: theme.inputBackground }]}>
            <FontAwesome name={'search'} size={14} color={theme.textSecondary} />
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={label}
                placeholderTextColor={theme.textSecondary}
                selectionColor={theme.primary}
                style={[styles.input, { color: theme.text }]}
                autoCorrect={false}
                autoCapitalize={'none'}
                returnKeyType={'search'}
                accessibilityLabel={label}
            />
            {value.length > 0 && (
                <TouchableOpacity
                    onPress={() => onChangeText('')}
                    accessibilityRole={'button'}
                    accessibilityLabel={t('clearSearch')}
                    hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                >
                    <FontAwesome name={'times-circle'} size={16} color={theme.textSecondary} />
                </TouchableOpacity>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.md,
        minHeight: 44,
    },
    input: {
        flex: 1,
        fontSize: FontSize.md,
        paddingVertical: Spacing.sm,
    },
})
