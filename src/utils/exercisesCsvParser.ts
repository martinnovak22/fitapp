import type { Exercise, ExerciseDetails, ExerciseMusclesInput, ExerciseType } from '@/src/db/exercises'
import {
    asEquipment,
    type Equipment,
    type ExerciseMuscles,
    hasExplicitMuscles,
    mapLegacyMuscleGroup,
    muscleGroupOf,
    resolveExerciseMuscles,
} from '@/src/domain/exerciseTaxonomy'

const VALID_TYPES: ExerciseType[] = ['weight', 'cardio', 'bodyweight', 'bodyweight_timer']
const VALID_TYPE_SET = new Set<ExerciseType>(VALID_TYPES)

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? ''

const nameTypeKey = (name: string, type: ExerciseType) => `${normalize(name)}|${normalize(type)}`

/**
 * Whether two Muscle descriptions name the same Exercise for import matching.
 * The same primary Muscle matches; so does a whole group against one of its
 * Muscles ("arms" vs "triceps"), because a coarse value is how older exports
 * and older app versions describe the same Exercise. Two *different* specific
 * Muscles ("biceps" vs "forearms") are different Exercises.
 */
export const sameMuscleIdentity = (a: ExerciseMuscles, b: ExerciseMuscles): boolean => {
    if (!a.primary || !b.primary) return a.primary === b.primary
    if (a.primary === b.primary) return true
    const group = muscleGroupOf(a.primary)
    return group === muscleGroupOf(b.primary) && (a.primary === group || b.primary === group)
}

/**
 * The existing Exercise a CSV row merges into: same name and type (case- and
 * whitespace-insensitive) and the same Muscle identity, preferring an exact
 * primary match over a group-level one.
 */
export const findImportMatch = (existing: readonly Exercise[], row: ParsedExerciseRow): Exercise | undefined => {
    const key = nameTypeKey(row.name, row.type)
    const candidates = existing.filter((exercise) => nameTypeKey(exercise.name, exercise.type) === key)
    return (
        candidates.find((exercise) => resolveExerciseMuscles(exercise).primary === row.muscles.primary) ??
        candidates.find((exercise) => sameMuscleIdentity(resolveExerciseMuscles(exercise), row.muscles))
    )
}

/** What a CSV row creates: its Muscles (or its raw text when unmapped) and Equipment. */
export const importCreateDetails = (row: ParsedExerciseRow): ExerciseDetails => ({
    muscles: { ...row.muscles, legacyText: row.muscleGroup },
    equipment: row.equipment ?? null,
})

/**
 * The Muscles a CSV row writes onto an existing Exercise, or undefined to keep
 * them. Re-importing never makes an Exercise *less* specific: a blank cell, or
 * a coarser value ("arms" onto an explicit "triceps"), keeps what is there,
 * and a row naming the same primary without secondaries keeps the existing
 * secondary Muscles.
 */
export const importMusclesUpdate = (existing: Exercise, row: ParsedExerciseRow): ExerciseMusclesInput | undefined => {
    if (!row.muscleGroup) return undefined
    const imported: ExerciseMusclesInput = { ...row.muscles, legacyText: row.muscleGroup }
    if (!hasExplicitMuscles(existing) || !row.muscles.primary) {
        // Nothing explicit to protect (or nothing recognizable to offer):
        // legacy text is replaced only by something that maps.
        return row.muscles.primary || !resolveExerciseMuscles(existing).primary ? imported : undefined
    }
    const current = resolveExerciseMuscles(existing)
    const currentPrimary = current.primary as NonNullable<ExerciseMuscles['primary']>
    const isCoarser = row.muscles.primary !== currentPrimary && row.muscles.primary === muscleGroupOf(currentPrimary)
    if (isCoarser) return undefined
    if (row.muscles.primary === currentPrimary && row.muscles.secondary.length === 0) {
        return { primary: currentPrimary, secondary: current.secondary }
    }
    return imported
}

/**
 * The muscle column of the CSV. Explicit taxonomy keys are written as keys
 * (primary first) so the importer maps them back exactly; an Exercise still on
 * legacy text exports that text verbatim, so nothing the user typed is lost.
 */
export const formatCsvMuscles = (exercise: Exercise): string => {
    if (!hasExplicitMuscles(exercise)) return exercise.muscle_group ?? ''
    const { primary, secondary } = resolveExerciseMuscles(exercise)
    return [primary, ...secondary].join(', ')
}

const resolveExerciseType = (rawType: string): ExerciseType | null => {
    const normalized = normalize(rawType).replace(/\s+/g, '_') as ExerciseType
    return VALID_TYPE_SET.has(normalized) ? normalized : null
}

/**
 * Splits a single CSV line into trimmed cells, honouring double-quoted fields
 * (which may contain commas) and the doubled-quote (`""`) escape.
 */
export const parseCsvLine = (line: string): string[] => {
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
        const char = line[i]
        const nextChar = line[i + 1]

        if (char === '"' && inQuotes && nextChar === '"') {
            current += '"'
            i++
            continue
        }

        if (char === '"') {
            inQuotes = !inQuotes
            continue
        }

        if (char === ',' && !inQuotes) {
            values.push(current.trim())
            current = ''
            continue
        }

        current += char
    }

    values.push(current.trim())
    return values
}

export interface ParsedExerciseRow {
    name: string
    type: ExerciseType
    // The raw muscle cell, kept as legacy text when it maps to no Muscle.
    muscleGroup?: string
    muscles: ExerciseMuscles
    equipment?: Equipment
}

export type CsvRowErrorReason = 'too-few-columns' | 'missing-name' | 'invalid-type' | 'duplicate-in-file'

export interface CsvRowError {
    /** 1-based line number in the original CSV text (the header is line 1). */
    line: number
    reason: CsvRowErrorReason
}

export interface ParsedExercisesCsv {
    /** Valid rows, de-duplicated within the file, in source order. */
    rows: ParsedExerciseRow[]
    /** One entry per rejected data row, in source order. */
    errors: CsvRowError[]
}

/**
 * Pure parser/validator for the exercise-import CSV format. Takes the raw file
 * text and returns the importable rows plus a validation error per rejected
 * row. The first line is always treated as a header and discarded; blank lines
 * are ignored. No I/O, no React Native, no database — the importer screen owns
 * the add/merge against existing exercises.
 */
export const parseExercisesCsv = (content: string): ParsedExercisesCsv => {
    const rows: ParsedExerciseRow[] = []
    const errors: CsvRowError[] = []
    const accepted = new Map<string, ParsedExerciseRow[]>()

    const lines = content.split('\n')
    for (let index = 1; index < lines.length; index++) {
        const line = lines[index]
        if (line.trim().length === 0) continue

        const lineNumber = index + 1
        const cells = parseCsvLine(line)
        if (cells.length < 2) {
            errors.push({ line: lineNumber, reason: 'too-few-columns' })
            continue
        }

        const name = cells[0].trim()
        if (!name) {
            errors.push({ line: lineNumber, reason: 'missing-name' })
            continue
        }

        const type = resolveExerciseType(cells[1])
        if (!type) {
            errors.push({ line: lineNumber, reason: 'invalid-type' })
            continue
        }

        const muscleGroup = cells[2]?.trim() || undefined
        const muscles = mapLegacyMuscleGroup(muscleGroup)
        // Column 4 is position (export only); column 5 is the optional Equipment.
        const equipment = asEquipment(normalize(cells[4]))
        const key = nameTypeKey(name, type)
        const sameNameType = accepted.get(key) ?? []
        if (sameNameType.some((row) => sameMuscleIdentity(row.muscles, muscles))) {
            errors.push({ line: lineNumber, reason: 'duplicate-in-file' })
            continue
        }

        const row: ParsedExerciseRow = { name, type, muscleGroup, muscles, ...(equipment ? { equipment } : {}) }
        accepted.set(key, [...sameNameType, row])
        rows.push(row)
    }

    return { rows, errors }
}
