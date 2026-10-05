export const formatDuration = (minutes: number): string => {
    const m = Math.floor(minutes)
    const s = Math.round((minutes - m) * 60)
    return `${m}:${s.toString().padStart(2, '0')}`
}

// A workout's length: "45 min", "1 h 16 min". The caller passes the localized
// minute unit.
export const formatWorkoutLength = (minutes: number, minuteUnit: string): string => {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    return h > 0 ? `${h} h ${m} ${minuteUnit}` : `${m} ${minuteUnit}`
}

export const formatExerciseType = (
    type?: string
): 'typeWeight' | 'typeCardio' | 'typeBodyweight' | 'typeBodyweightTimer' | 'typeUnknown' => {
    // Legacy untyped rows default to Weight (the original convention); a present
    // but unrecognized value is surfaced as Unknown rather than silently mislabeled.
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
            return 'typeUnknown'
    }
}
