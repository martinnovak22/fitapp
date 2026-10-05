// Pure rules behind the Workout Template editor: validation of the name and
// membership. Exercise search and grouping live in exerciseFilters.

export const TEMPLATE_NAME_MAX_LENGTH = 40

export type TemplateValidation =
    | { ok: true; name: string; exerciseUuids: string[] }
    | { ok: false; field: 'name' | 'exercises'; errorKey: 'templateNameRequired' | 'templateNeedsExercise' }

// `exerciseUuids` is the whole selection, kept verbatim: members whose Exercise
// is not on this device yet (not pulled, or parked) must survive a save, or the
// last-writer-wins push would strip them from every device. Only the live
// members count towards "at least one Exercise".
export const validateTemplate = (input: {
    name: string
    exerciseUuids: readonly string[]
    liveMemberCount: number
}): TemplateValidation => {
    const name = input.name.trim()
    if (!name) return { ok: false, field: 'name', errorKey: 'templateNameRequired' }
    if (input.liveMemberCount === 0) return { ok: false, field: 'exercises', errorKey: 'templateNeedsExercise' }
    return { ok: true, name, exerciseUuids: [...input.exerciseUuids] }
}
