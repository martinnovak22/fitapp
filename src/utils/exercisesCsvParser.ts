import type { ExerciseType } from '@/src/db/exercises'

const VALID_TYPES: ExerciseType[] = ['weight', 'cardio', 'bodyweight', 'bodyweight_timer']
const VALID_TYPE_SET = new Set<ExerciseType>(VALID_TYPES)

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? ''

/**
 * Case/whitespace-insensitive identity for an exercise. Shared with the
 * importer so in-file dedup and existing-row matching use the exact same key.
 */
export const buildExerciseKey = (name: string, type: ExerciseType, muscleGroup?: string) =>
    `${normalize(name)}|${normalize(type)}|${normalize(muscleGroup)}`

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
    muscleGroup?: string
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
    const seenKeys = new Set<string>()

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
        const key = buildExerciseKey(name, type, muscleGroup)
        if (seenKeys.has(key)) {
            errors.push({ line: lineNumber, reason: 'duplicate-in-file' })
            continue
        }

        seenKeys.add(key)
        rows.push({ name, type, muscleGroup })
    }

    return { rows, errors }
}
