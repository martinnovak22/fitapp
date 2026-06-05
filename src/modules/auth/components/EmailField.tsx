import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, TextInput } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'

type EmailFieldProps = {
    value: string
    onChangeText: (value: string) => void
}

// The email label + input. No branching of its own; extracted so the screen is
// a flat list of form rows rather than an inline input definition.
export const EmailField = forwardRef<TextInput, EmailFieldProps>(function EmailField({ value, onChangeText }, ref) {
    const { t } = useTranslation()
    const { theme } = useTheme()

    return (
        <>
            <Typography.Label>{t('email')}</Typography.Label>
            <TextInput
                ref={ref}
                value={value}
                onChangeText={onChangeText}
                autoCapitalize={'none'}
                autoCorrect={false}
                keyboardType={'email-address'}
                textContentType={'emailAddress'}
                autoComplete={'email'}
                returnKeyType={'next'}
                placeholder={t('emailPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                style={[
                    styles.input,
                    {
                        color: theme.text,
                        borderColor: theme.border,
                        backgroundColor: theme.inputBackground,
                    },
                ]}
            />
        </>
    )
})

const styles = StyleSheet.create({
    input: {
        borderWidth: 1,
        borderRadius: Radius.sm,
        minHeight: 48,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        marginBottom: Spacing.sm,
    },
})
