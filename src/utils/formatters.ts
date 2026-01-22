export const formatDuration = (minutes: number): string => {
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

export const formatExerciseType = (type?: string): string => {
    if (!type) return '';
    const normalized = type.toLowerCase();
    switch (normalized) {
        case 'weight': return 'Weight';
        case 'cardio': return 'Cardio';
        case 'bodyweight': return 'Bodyweight';
        case 'bodyweight_timer': return 'Bodyweight (Timer)';
        default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
};

export const formatMuscleGroup = (muscleGroup?: string): string => {
    if (!muscleGroup) return '';
    return muscleGroup.charAt(0).toUpperCase() + muscleGroup.slice(1).toLowerCase();
};
