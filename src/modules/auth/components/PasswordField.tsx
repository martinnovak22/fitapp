import React from 'react'
import { useTranslation } from 'react-i18next'
import { type StyleProp, StyleSheet, TextInput, type TextInputProps, View, type ViewStyle } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { Button } from '@/src/modules/core/components/Button'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'

type PasswordFieldProps = {
    label: string
    value: string
    onChangeText: (value: string) => void
    isVisible: boolean
    onToggleVisibility: () => void
    textContentType: TextInputProps['textContentType']
    autoComplete: TextInputProps['autoComplete']
    returnKeyType: TextInputProps['returnKeyType']
    onSubmitEditing?: () => void
    containerStyle?: StyleProp<ViewStyle>
}

// A masked password input with the in-field show/hide toggle. Owns the
// "render the eye button only once the field has content" branch so the screen
// stays a flat layout.
export function PasswordField({
    label,
    value,
    onChangeText,
    isVisible,
    onToggleVisibility,
    textContentType,
    autoComplete,
    returnKeyType,
    onSubmitEditing,
    containerStyle,
}: PasswordFieldProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()

    return (
        <View style={containerStyle}>
            <Typography.Label>{label}</Typography.Label>
            <View style={styles.passwordInputContainer}>
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={!isVisible}
                    autoCorrect={false}
                    textContentType={textContentType}
                    autoComplete={autoComplete}
                    returnKeyType={returnKeyType}
                    onSubmitEditing={onSubmitEditing}
                    placeholder={t('passwordPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    style={[
                        styles.input,
                        styles.passwordInput,
                        {
                            color: theme.text,
                            borderColor: theme.border,
                            backgroundColor: theme.inputBackground,
                        },
                    ]}
                />
                {value.length > 0 ? (
                    <Button
                        leftIcon={isVisible ? 'eye-slash' : 'eye'}
                        onPress={onToggleVisibility}
                        variant={'text'}
                        accessibilityLabel={isVisible ? t('hidePassword') : t('showPassword')}
                        labelStyle={{ color: theme.textSecondary }}
                        style={styles.visibilityButton}
                    />
                ) : null}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    input: {
        borderWidth: 1,
        borderRadius: Radius.sm,
        minHeight: 48,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    passwordInputContainer: {
        position: 'relative',
        justifyContent: 'center',
    },
    passwordInput: {
        paddingRight: Spacing.xl2 + Spacing.sm,
    },
    visibilityButton: {
        position: 'absolute',
        right: Spacing.md,
        top: 0,
        bottom: Spacing.sm,
        justifyContent: 'center',
    },
})
