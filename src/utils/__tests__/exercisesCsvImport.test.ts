import { describe, expect, it } from 'vitest'
import type { Exercise } from '@/src/db/exercises'
import {
    findImportMatch,
    formatCsvMuscles,
    importCreateDetails,
    importMusclesUpdate,
    parseExercisesCsv,
    sameMuscleIdentity,
} from '@/src/utils/exercisesCsvParser'

const HEADER = 'name,type,muscle_group,position,equipment'

const exercise = (overrides: Partial<Exercise>): Exercise => ({
    id: 1,
    name: 'Bench',
    type: 'weight',
    position: 0,
    ...overrides,
})

const rowFor = (cells: string) => {
    const [row] = parseExercisesCsv([HEADER, cells].join('\n')).rows
    return row
}

describe('sameMuscleIdentity', () => {
    it('matches a group against one of its muscles, but not two different muscles', () => {
        expect(sameMuscleIdentity({ primary: 'arms', secondary: [] }, { primary: 'triceps', secondary: [] })).toBe(true)
        expect(sameMuscleIdentity({ primary: 'biceps', secondary: [] }, { primary: 'forearms', secondary: [] })).toBe(
            false
        )
        expect(sameMuscleIdentity({ primary: null, secondary: [] }, { primary: null, secondary: [] })).toBe(true)
        expect(sameMuscleIdentity({ primary: null, secondary: [] }, { primary: 'arms', secondary: [] })).toBe(false)
    })
})

describe('parseExercisesCsv in-file duplicates', () => {
    it('keeps two rows that differ by a specific Muscle', () => {
        const csv = [HEADER, 'Curl,weight,biceps', 'Curl,weight,forearms'].join('\n')
        expect(parseExercisesCsv(csv).rows).toHaveLength(2)
    })
})

describe('CSV round trip', () => {
    it('exports explicit keys and reads them back exactly, Equipment included', () => {
        const source = exercise({
            primary_muscle: 'chest',
            secondary_muscles: '["triceps","front_delts"]',
            muscle_group: 'chest',
            equipment: 'barbell',
        })
        const row = rowFor(`"Bench","weight","${formatCsvMuscles(source)}",0,"${source.equipment}"`)
        expect(row.muscles).toEqual({ primary: 'chest', secondary: ['triceps', 'front_delts'] })
        expect(row.equipment).toBe('barbell')
    })

    it('exports legacy text verbatim, including words that map to no Muscle', () => {
        expect(formatCsvMuscles(exercise({ muscle_group: 'hrudník, posilovna' }))).toBe('hrudník, posilovna')
    })
})

describe('findImportMatch', () => {
    const triceps = exercise({ id: 1, name: 'Pushdown', primary_muscle: 'triceps', muscle_group: 'arms' })
    const legacyArms = exercise({ id: 2, name: 'Pushdown', muscle_group: 'ruce' })

    it('prefers the exact primary Muscle', () => {
        expect(findImportMatch([legacyArms, triceps], rowFor('pushdown,Weight,triceps'))?.id).toBe(1)
    })

    it('falls back to a group-level match', () => {
        expect(findImportMatch([triceps], rowFor('Pushdown,weight,arms'))?.id).toBe(1)
    })

    it('does not match a different specific Muscle or another type', () => {
        expect(findImportMatch([triceps], rowFor('Pushdown,weight,biceps'))).toBeUndefined()
        expect(findImportMatch([triceps], rowFor('Pushdown,cardio,triceps'))).toBeUndefined()
    })
})

describe('importMusclesUpdate', () => {
    const explicit = exercise({ primary_muscle: 'triceps', secondary_muscles: '["chest"]', muscle_group: 'arms' })

    it('never downgrades explicit Muscles to their group', () => {
        expect(importMusclesUpdate(explicit, rowFor('Bench,weight,arms'))).toBeUndefined()
    })

    it('keeps existing secondary Muscles when the row names the same primary alone', () => {
        expect(importMusclesUpdate(explicit, rowFor('Bench,weight,triceps'))).toEqual({
            primary: 'triceps',
            secondary: ['chest'],
        })
    })

    it('takes a more specific or different description', () => {
        expect(importMusclesUpdate(explicit, rowFor('Bench,weight,"triceps, front_delts"'))).toMatchObject({
            primary: 'triceps',
            secondary: ['front_delts'],
        })
        const coarse = exercise({ primary_muscle: 'arms', muscle_group: 'arms' })
        expect(importMusclesUpdate(coarse, rowFor('Bench,weight,triceps'))?.primary).toBe('triceps')
    })

    it('leaves Muscles alone for a blank cell or text that maps to nothing', () => {
        expect(importMusclesUpdate(explicit, rowFor('Bench,weight,'))).toBeUndefined()
        expect(importMusclesUpdate(explicit, rowFor('Bench,weight,posilovna'))).toBeUndefined()
        expect(importMusclesUpdate(exercise({ muscle_group: 'hrudník' }), rowFor('Bench,weight,posilovna'))).toBe(
            undefined
        )
    })

    it('makes legacy text explicit when the row maps', () => {
        expect(importMusclesUpdate(exercise({ muscle_group: 'hrudník' }), rowFor('Bench,weight,chest'))).toMatchObject({
            primary: 'chest',
            secondary: [],
        })
    })
})

describe('importCreateDetails', () => {
    it('keeps unmapped text as legacy text', () => {
        expect(importCreateDetails(rowFor('Neck,weight,krk'))).toEqual({
            muscles: { primary: null, secondary: [], legacyText: 'krk' },
            equipment: null,
        })
    })
})
