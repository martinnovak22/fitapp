export const formatDuration = (minutes: number): string => {
    const m = Math.floor(minutes)
    const s = Math.round((minutes - m) * 60)
    return `${m}:${s.toString().padStart(2, '0')}`
}

export const formatExerciseType = (
    type?: string
): 'typeWeight' | 'typeCardio' | 'typeBodyweight' | 'typeBodyweightTimer' => {
    if (!type) return 'typeWeight'
    const normalized = type.toLowerCase()
    switch (normalized) {
        case 'weight':
            return 'typeWeight'
        case 'cardio':
            return 'typeCardio'
        case 'bodyweight':
            return 'typeBodyweight'
        case 'bodyweight_timer':
            return 'typeBodyweightTimer'
        default:
            return 'typeWeight'
    }
}

export const formatMuscleGroup = (muscleGroup?: string): string => {
    if (!muscleGroup) return ''
    return muscleGroup.charAt(0).toUpperCase() + muscleGroup.slice(1).toLowerCase()
}
