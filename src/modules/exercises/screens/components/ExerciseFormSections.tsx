import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useTranslation } from 'react-i18next'
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import type { ExerciseType } from '@/src/db/exercises'
import { Appear } from '@/src/modules/core/components/motion'
import { SegmentedControl } from '@/src/modules/core/components/SegmentedControl'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { resolveExerciseTypeOptions, resolveTrackingModeToggle } from '../../exerciseForm'

type ExerciseTypeFieldProps = {
    type: ExerciseType
    // A type change from the main control (may trigger taxonomy suggestions).
    onTypeChange: (value: ExerciseType) => void
    // A Tracking Mode change: bodyweight reps vs timer.
    onTrackingModeChange: (value: ExerciseType) => void
}

// ExerciseType as a segmented control, plus the Tracking Mode control that
// only appears for Bodyweight. Its parent owns the layout transition.
export function ExerciseTypeField({ type, onTypeChange, onTrackingModeChange }: ExerciseTypeFieldProps) {
    const { t } = useTranslation()
    const typeOptions = resolveExerciseTypeOptions(type)
    const trackingOptions = resolveTrackingModeToggle(type)
    const activeType = typeOptions.find((option) => option.isActive)?.value ?? 'weight'
    const activeTracking = trackingOptions?.find((option) => option.isActive)?.value

    return (
        <View style={styles.typeField}>
            <View style={styles.field}>
                <Typography.Label style={styles.fieldLabel} accessibilityRole={'header'}>
                    {t('exerciseType')}
                </Typography.Label>
                <SegmentedControl
                    segments={typeOptions.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                    value={activeType}
                    onChange={onTypeChange}
                    accessibilityLabel={t('exerciseType')}
                />
            </View>
            {trackingOptions && activeTracking && (
                <Appear style={styles.field}>
                    <Typography.Label style={styles.fieldLabel} accessibilityRole={'header'}>
                        {t('trackingMode')}
                    </Typography.Label>
                    <SegmentedControl
                        segments={trackingOptions.map((option) => ({
                            value: option.value,
                            label: t(option.labelKey),
                        }))}
                        value={activeTracking}
                        onChange={onTrackingModeChange}
                        accessibilityLabel={t('trackingMode')}
                    />
                </Appear>
            )}
        </View>
    )
}

type ExercisePhotoThumbProps = {
    photoUri: string | null
    onPress: () => void
}

// The photo as a small leading thumbnail next to the name; tapping it opens
// the photo actions (take, choose, view, remove).
export function ExercisePhotoThumb({ photoUri, onPress }: ExercisePhotoThumbProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    return (
        <TouchableOpacity
            onPress={onPress}
            style={[styles.thumb, { backgroundColor: theme.inputBackground }]}
            accessibilityRole={'button'}
            accessibilityLabel={photoUri ? t('photo') : t('addPhoto')}
        >
            {photoUri ? (
                <Image key={photoUri} source={{ uri: photoUri }} style={styles.thumbImage} />
            ) : (
                <FontAwesome name={'camera'} size={20} color={theme.textSecondary} />
            )}
        </TouchableOpacity>
    )
}

export const PHOTO_THUMB_SIZE = 56

const styles = StyleSheet.create({
    typeField: {
        gap: Spacing.md,
    },
    field: {
        gap: Spacing.sm,
    },
    fieldLabel: {
        paddingHorizontal: Spacing.md,
    },
    thumb: {
        width: PHOTO_THUMB_SIZE,
        height: PHOTO_THUMB_SIZE,
        borderRadius: Radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    thumbImage: {
        width: '100%',
        height: '100%',
    },
})
