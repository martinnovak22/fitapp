import { useTranslation } from 'react-i18next'
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import type { Exercise } from '@/src/db/exercises'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { formatExerciseType, formatMuscleGroup } from '@/src/utils/formatters'

interface ExerciseInfoRowProps {
    exercise: Exercise
    onOpenPhoto: () => void
}

// The top row of the detail card: exercise type, muscle group, and the optional
// tappable photo.
export function ExerciseInfoRow({ exercise, onOpenPhoto }: ExerciseInfoRowProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()

    return (
        <View style={styles.row}>
            <View style={styles.labels}>
                <View style={styles.labelGroup}>
                    <Typography.Label>{t('type')}</Typography.Label>
                    <Typography.Body>{t(formatExerciseType(exercise.type))}</Typography.Body>
                </View>
                <View style={styles.labelGroup}>
                    <Typography.Label>{t('muscleGroup')}</Typography.Label>
                    <Typography.Body>
                        {exercise.muscle_group ? formatMuscleGroup(exercise.muscle_group) : t('notSpecified')}
                    </Typography.Body>
                </View>
            </View>

            {exercise.photo_uri && (
                <TouchableOpacity
                    style={[styles.photoContainer, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                    onPress={onOpenPhoto}
                    activeOpacity={0.9}
                >
                    <Image key={exercise.photo_uri} source={{ uri: exercise.photo_uri }} style={styles.photo} />
                </TouchableOpacity>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        height: 120,
        marginBottom: Spacing.md,
    },
    labels: {
        flexDirection: 'column',
        gap: Spacing.md,
        justifyContent: 'space-between',
    },
    labelGroup: {
        gap: Spacing.sm,
    },
    photoContainer: {
        width: '50%',
        height: 120,
        borderRadius: Radius.md,
        overflow: 'hidden',
        borderWidth: 1,
    },
    photo: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
})
