import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useTranslation } from 'react-i18next'
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontSize, FontWeight } from '@/src/constants/Typography'
import type { ExerciseType } from '@/src/db/exercises'
import { Button } from '@/src/modules/core/components/Button'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { resolveExerciseTypeOptions, resolveTrackingModeToggle } from '../../exerciseForm'

type ExerciseTypeSelectorProps = {
    type: ExerciseType
    onSelect: (value: ExerciseType) => void
}

export function ExerciseTypeSelector({ type, onSelect }: ExerciseTypeSelectorProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    return (
        <Animated.View layout={LinearTransition.duration(300)} style={styles.typeContainer}>
            {resolveExerciseTypeOptions(type).map((option) => (
                <TouchableOpacity
                    key={option.value}
                    style={[
                        styles.typeButton,
                        { borderColor: theme.border },
                        option.isActive && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                    onPress={() => onSelect(option.value)}
                    accessibilityRole={'button'}
                    accessibilityLabel={t(option.labelKey)}
                    accessibilityState={{ selected: option.isActive }}
                >
                    <Typography.Meta
                        style={[
                            styles.typeButtonText,
                            { color: theme.textSecondary },
                            option.isActive && { color: theme.onPrimary },
                        ]}
                    >
                        {t(option.labelKey)}
                    </Typography.Meta>
                </TouchableOpacity>
            ))}
        </Animated.View>
    )
}

type TrackingModeToggleProps = {
    type: ExerciseType
    onSelect: (value: ExerciseType) => void
}

export function TrackingModeToggle({ type, onSelect }: TrackingModeToggleProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const options = resolveTrackingModeToggle(type)
    if (!options) return null

    return (
        <Animated.View entering={FadeIn} layout={LinearTransition} style={{ marginTop: 20 }}>
            <Typography.Label style={{ fontSize: FontSize.xs, marginBottom: 6 }}>{t('trackingMode')}</Typography.Label>
            <View style={[styles.subToggleContainer, { backgroundColor: theme.inputBackground }]}>
                {options.map((option) => (
                    <TouchableOpacity
                        key={option.value}
                        style={[
                            styles.subToggleButton,
                            { backgroundColor: 'transparent' },
                            option.isActive && [
                                styles.subToggleButtonActive,
                                {
                                    backgroundColor: theme.inputBackgroundActive,
                                    borderColor: theme.inputBackgroundActive,
                                },
                            ],
                        ]}
                        onPress={() => onSelect(option.value)}
                        accessibilityRole={'button'}
                        accessibilityLabel={t(option.labelKey)}
                        accessibilityState={{ selected: option.isActive }}
                    >
                        <Typography.Meta
                            style={[
                                styles.subToggleText,
                                { color: theme.textSecondary },
                                option.isActive && [styles.subToggleTextActive, { color: theme.text }],
                            ]}
                        >
                            {t(option.labelKey)}
                        </Typography.Meta>
                    </TouchableOpacity>
                ))}
            </View>
        </Animated.View>
    )
}

type ExercisePhotoFieldProps = {
    photoUri: string | null
    onOpenFullScreen: () => void
    onRemove: () => void
    onPick: () => void
}

export function ExercisePhotoField({ photoUri, onOpenFullScreen, onRemove, onPick }: ExercisePhotoFieldProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    return (
        <Animated.View entering={FadeIn} layout={LinearTransition} style={styles.photoSection}>
            <Typography.Subtitle style={{ marginTop: 24, marginBottom: 12 }}>{t('photo')}</Typography.Subtitle>
            {photoUri ? (
                <TouchableOpacity
                    style={[
                        styles.photoWrapper,
                        {
                            backgroundColor: theme.surfaceSubtle,
                            borderColor: theme.inputBackgroundActive,
                        },
                    ]}
                    onPress={onOpenFullScreen}
                    accessibilityRole={'button'}
                    accessibilityLabel={t('photo')}
                >
                    <Image key={photoUri} source={{ uri: photoUri }} style={styles.photo} />
                    <Button
                        leftIcon={'trash'}
                        onPress={onRemove}
                        variant={'text'}
                        accessibilityLabel={t('delete')}
                        labelStyle={{ color: theme.error }}
                        style={[styles.removePhotoButton, { backgroundColor: theme.overlayScrim }]}
                    />
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={[
                        styles.addPhotoButton,
                        {
                            backgroundColor: theme.surfaceSubtle,
                            borderColor: theme.inputBackground,
                        },
                    ]}
                    onPress={onPick}
                    accessibilityRole={'button'}
                    accessibilityLabel={t('photo')}
                >
                    <FontAwesome name={'camera'} size={30} color={theme.primary} />
                    <Typography.Meta style={[styles.addPhotoText, { color: theme.primary }]}>
                        {t('photo')}
                    </Typography.Meta>
                </TouchableOpacity>
            )}
        </Animated.View>
    )
}

const styles = StyleSheet.create({
    typeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    typeButton: {
        flex: 1,
        minWidth: '30%',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.sm,
        borderWidth: 1,
        alignItems: 'center',
    },
    typeButtonText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
    },
    subToggleContainer: {
        flexDirection: 'row',
        borderRadius: Radius.sm,
        padding: 4,
    },
    subToggleButton: {
        flex: 1,
        paddingVertical: Spacing.xs,
        alignItems: 'center',
        borderRadius: Radius.sm,
    },
    subToggleButtonActive: {
        borderWidth: 1,
    },
    subToggleText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
    },
    subToggleTextActive: {
        fontWeight: FontWeight.bold,
    },
    photoSection: {
        marginBottom: Spacing.sm,
    },
    addPhotoButton: {
        width: '100%',
        height: 160,
        borderRadius: Radius.md,
        borderWidth: 2,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    addPhotoText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
    },
    photoWrapper: {
        width: '100%',
        height: 160,
        borderRadius: Radius.md,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 1,
    },
    photo: {
        height: 160,
        width: '100%',
        resizeMode: 'cover',
    },
    removePhotoButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 30,
        height: 30,
        borderRadius: Radius.pill,
        justifyContent: 'center',
        alignItems: 'center',
    },
})
