import { describe, expect, it } from 'vitest'
import { parseCsvLine, parseExercisesCsv } from '@/src/utils/exercisesCsvParser'

const HEADER = 'name,type,muscle_group,position'

describe('parseCsvLine', () => {
    it('splits a plain comma-separated line and trims each cell', () => {
        expect(parseCsvLine('Bench Press, weight , Chest ')).toEqual(['Bench Press', 'weight', 'Chest'])
    })

    it('keeps commas that live inside quoted fields', () => {
        expect(parseCsvLine('"Squat, low bar",weight,Legs')).toEqual(['Squat, low bar', 'weight', 'Legs'])
    })

    it('unescapes doubled quotes inside a quoted field', () => {
        expect(parseCsvLine('"Pull ""wide"" up",bodyweight')).toEqual(['Pull "wide" up', 'bodyweight'])
    })

    it('returns a single empty cell for an empty line', () => {
        expect(parseCsvLine('')).toEqual([''])
    })
})

describe('parseExercisesCsv', () => {
    it('returns no rows and no errors for empty input', () => {
        expect(parseExercisesCsv('')).toEqual({ rows: [], errors: [] })
    })

    it('returns no rows for a header-only file', () => {
        expect(parseExercisesCsv(HEADER)).toEqual({ rows: [], errors: [] })
    })

    it('parses well-formed data rows and drops the header line', () => {
        const csv = [HEADER, 'Bench Press,weight,Chest,0', 'Run,cardio,,1'].join('\n')

        const result = parseExercisesCsv(csv)

        expect(result.errors).toEqual([])
        expect(result.rows).toEqual([
            {
                name: 'Bench Press',
                type: 'weight',
                muscleGroup: 'Chest',
                muscles: { primary: 'chest', secondary: [] },
            },
            { name: 'Run', type: 'cardio', muscleGroup: undefined, muscles: { primary: null, secondary: [] } },
        ])
    })

    it('treats the first line as a header even when it is actually data', () => {
        // Behaviour-preserving: the importer has always discarded line 1.
        const result = parseExercisesCsv('Bench Press,weight,Chest,0')
        expect(result.rows).toEqual([])
    })

    it('ignores blank lines without recording an error', () => {
        const csv = [HEADER, '', 'Run,cardio', '   ', 'Plank,bodyweight_timer'].join('\n')

        const result = parseExercisesCsv(csv)

        expect(result.errors).toEqual([])
        expect(result.rows.map((r) => r.name)).toEqual(['Run', 'Plank'])
    })

    it('parses despite extra header columns and extra row columns', () => {
        const csv = ['name,type,muscle_group,position,notes', 'Run,cardio,,1,ignored-extra'].join('\n')

        const result = parseExercisesCsv(csv)

        expect(result.errors).toEqual([])
        expect(result.rows).toEqual([
            { name: 'Run', type: 'cardio', muscleGroup: undefined, muscles: { primary: null, secondary: [] } },
        ])
    })

    it('flags a row with fewer than two columns as too-few-columns', () => {
        const csv = [HEADER, 'OnlyName'].join('\n')

        const result = parseExercisesCsv(csv)

        expect(result.rows).toEqual([])
        expect(result.errors).toEqual([{ line: 2, reason: 'too-few-columns' }])
    })

    it('flags a row with a blank name as missing-name', () => {
        const csv = [HEADER, ',weight,Chest'].join('\n')

        const result = parseExercisesCsv(csv)

        expect(result.rows).toEqual([])
        expect(result.errors).toEqual([{ line: 2, reason: 'missing-name' }])
    })

    it('flags an unrecognised type as invalid-type', () => {
        const csv = [HEADER, 'Yoga,stretching,Core'].join('\n')

        const result = parseExercisesCsv(csv)

        expect(result.rows).toEqual([])
        expect(result.errors).toEqual([{ line: 2, reason: 'invalid-type' }])
    })

    it('normalises type casing and whitespace into the canonical unit', () => {
        const csv = [HEADER, 'Bench, WEIGHT ,Chest', 'Plank,Bodyweight Timer,Core'].join('\n')

        const result = parseExercisesCsv(csv)

        expect(result.errors).toEqual([])
        expect(result.rows.map((r) => r.type)).toEqual(['weight', 'bodyweight_timer'])
    })

    it('drops an empty muscle group to undefined', () => {
        const csv = [HEADER, 'Run,cardio,', 'Jog,cardio'].join('\n')

        const result = parseExercisesCsv(csv)

        expect(result.rows).toEqual([
            { name: 'Run', type: 'cardio', muscleGroup: undefined, muscles: { primary: null, secondary: [] } },
            { name: 'Jog', type: 'cardio', muscleGroup: undefined, muscles: { primary: null, secondary: [] } },
        ])
    })

    it('keeps the first of an in-file duplicate and flags the rest case-insensitively', () => {
        const csv = [HEADER, 'Bench,weight,Chest', 'bench , Weight , chest ', 'Bench,weight,Back'].join('\n')

        const result = parseExercisesCsv(csv)

        expect(result.rows).toEqual([
            { name: 'Bench', type: 'weight', muscleGroup: 'Chest', muscles: { primary: 'chest', secondary: [] } },
            { name: 'Bench', type: 'weight', muscleGroup: 'Back', muscles: { primary: 'back', secondary: [] } },
        ])
        expect(result.errors).toEqual([{ line: 3, reason: 'duplicate-in-file' }])
    })

    it('treats legacy text and taxonomy keys for the same Muscle Group as the same Exercise', () => {
        const csv = [HEADER, 'Bench,weight,hrudník', 'Bench,weight,"chest, triceps"'].join('\n')

        const result = parseExercisesCsv(csv)

        expect(result.rows).toHaveLength(1)
        expect(result.errors).toEqual([{ line: 3, reason: 'duplicate-in-file' }])
    })

    it('reads exported keys back into a primary and secondary Muscles plus Equipment', () => {
        const csv = [
            'name,type,muscle_group,position,equipment',
            'Bench,weight,"chest, triceps, front_delts",0,barbell',
        ].join('\n')

        const [row] = parseExercisesCsv(csv).rows

        expect(row.muscles).toEqual({ primary: 'chest', secondary: ['triceps', 'front_delts'] })
        expect(row.equipment).toBe('barbell')
    })

    it('ignores an unknown Equipment value', () => {
        const csv = ['name,type,muscle_group,position,equipment', 'Bench,weight,chest,0,spaceship'].join('\n')
        expect(parseExercisesCsv(csv).rows[0]).not.toHaveProperty('equipment')
    })

    it('reports the original line number for each error across mixed rows', () => {
        const csv = [HEADER, 'Run,cardio', 'OnlyName', 'Yoga,stretching'].join('\n')

        const result = parseExercisesCsv(csv)

        expect(result.rows.map((r) => r.name)).toEqual(['Run'])
        expect(result.errors).toEqual([
            { line: 3, reason: 'too-few-columns' },
            { line: 4, reason: 'invalid-type' },
        ])
    })
})
