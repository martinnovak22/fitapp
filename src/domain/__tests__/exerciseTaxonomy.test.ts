import { describe, expect, it } from 'vitest'
import {
    asEquipment,
    asMuscleKey,
    buildMuscleSections,
    compareMuscleGroups,
    hasExplicitMuscles,
    isEquipment,
    isMuscleKey,
    MUSCLE_GROUPS,
    MUSCLE_TAXONOMY,
    mapLegacyMuscleGroup,
    muscleGroupOf,
    parseSecondaryMuscles,
    parseStoredMuscleList,
    resolveExerciseMuscleGroup,
    resolveExerciseMuscles,
    serializeSecondaryMuscles,
} from '../exerciseTaxonomy'

describe('muscle taxonomy', () => {
    it('resolves every Muscle to its group and a group to itself', () => {
        expect(muscleGroupOf('triceps')).toBe('arms')
        expect(muscleGroupOf('glutes')).toBe('legs')
        expect(muscleGroupOf('legs')).toBe('legs')
        expect(muscleGroupOf('chest')).toBe('chest')
    })

    it('keeps group keys and specific muscle keys disjoint', () => {
        const specific = MUSCLE_TAXONOMY.flatMap((entry) => [...entry.muscles])
        expect(specific.filter((muscle) => (MUSCLE_GROUPS as readonly string[]).includes(muscle))).toEqual([])
        expect(new Set(specific).size).toBe(specific.length)
    })

    it('recognizes only exact keys', () => {
        expect(isMuscleKey('cardio')).toBe(true)
        expect(isMuscleKey('Chest')).toBe(false)
        expect(isMuscleKey('hrudník')).toBe(false)
        expect(asMuscleKey('neck')).toBeNull()
        expect(asMuscleKey('glutes')).toBe('glutes')
    })

    it('orders groups by taxonomy with unclassified last', () => {
        const groups = ['cardio', null, 'chest', 'legs'] as const
        expect([...groups].sort(compareMuscleGroups)).toEqual(['chest', 'legs', 'cardio', null])
    })

    it('recognizes Equipment keys only', () => {
        expect(isEquipment('barbell')).toBe(true)
        expect(isEquipment('činka')).toBe(false)
        expect(asEquipment('barbell')).toBe('barbell')
        expect(asEquipment('spaceship')).toBeNull()
    })
})

describe('buildMuscleSections', () => {
    it('titles groups with specific Muscles, offering the whole group first', () => {
        const back = buildMuscleSections().find((section) => section.title === 'back')
        expect(back?.options).toEqual([
            { key: 'back', isWholeGroup: true },
            { key: 'lats', isWholeGroup: false },
            { key: 'upper_back', isWholeGroup: false },
            { key: 'lower_back', isWholeGroup: false },
        ])
    })

    it('gathers consecutive groups without specific Muscles into untitled rows', () => {
        const untitled = buildMuscleSections().filter((section) => section.title === null)
        expect(untitled.map((section) => section.options.map((option) => option.key))).toEqual([
            ['chest'],
            ['full_body', 'cardio'],
        ])
    })

    it('offers every Muscle key exactly once', () => {
        const keys = buildMuscleSections().flatMap((section) => section.options.map((option) => option.key))
        expect(new Set(keys).size).toBe(keys.length)
        expect(keys).toHaveLength(MUSCLE_TAXONOMY.reduce((n, entry) => n + 1 + entry.muscles.length, 0))
    })
})

describe('mapLegacyMuscleGroup', () => {
    // Every distinct value present in production data on 2026-10-02.
    it.each([
        ['chest', 'chest'],
        ['ramena', 'shoulders'],
        ['arm', 'arms'],
        ['back', 'back'],
        ['záda', 'back'],
        ['shoulders', 'shoulders'],
        ['hrudnik', 'chest'],
        ['břicho', 'abs'],
        ['triceps', 'triceps'],
        ['core', 'core'],
        ['hrudník', 'chest'],
        ['legs', 'legs'],
        ['nohy', 'legs'],
        ['ruce', 'arms'],
        ['biceps', 'biceps'],
        ['stred tela', 'core'],
    ])('maps %s to %s', (raw, expected) => {
        expect(mapLegacyMuscleGroup(raw)).toEqual({ primary: expected, secondary: [] })
    })

    it('splits a typed list into a primary and secondary Muscles', () => {
        expect(mapLegacyMuscleGroup('prsa, triceps, rameno')).toEqual({
            primary: 'chest',
            secondary: ['triceps', 'shoulders'],
        })
        expect(mapLegacyMuscleGroup('Záda a Biceps')).toEqual({ primary: 'back', secondary: ['biceps'] })
    })

    it('accepts canonical keys, as written by the CSV export', () => {
        expect(mapLegacyMuscleGroup('chest, triceps, front_delts')).toEqual({
            primary: 'chest',
            secondary: ['triceps', 'front_delts'],
        })
        expect(mapLegacyMuscleGroup('front delts')).toEqual({ primary: 'front_delts', secondary: [] })
    })

    it('knows common Czech spellings of specific muscles', () => {
        expect(mapLegacyMuscleGroup('přední delty').primary).toBe('front_delts')
        expect(mapLegacyMuscleGroup('Zadní delty').primary).toBe('rear_delts')
        expect(mapLegacyMuscleGroup('kvadricepsy').primary).toBe('quads')
        expect(mapLegacyMuscleGroup('zadní stehna').primary).toBe('hamstrings')
    })

    it('splits hyphenated lists', () => {
        expect(mapLegacyMuscleGroup('Ramena-Triceps')).toEqual({ primary: 'shoulders', secondary: ['triceps'] })
        expect(mapLegacyMuscleGroup('nohy - quads')).toEqual({ primary: 'legs', secondary: ['quads'] })
        expect(mapLegacyMuscleGroup('full-body')).toEqual({ primary: 'full_body', secondary: [] })
        expect(mapLegacyMuscleGroup('full-body, cardio')).toEqual({ primary: 'full_body', secondary: ['cardio'] })
    })

    it('is case-, accent- and whitespace-insensitive', () => {
        expect(mapLegacyMuscleGroup('  Střed   Těla ')).toEqual({ primary: 'core', secondary: [] })
    })

    it('yields no primary for blank or unrecognized text instead of guessing', () => {
        expect(mapLegacyMuscleGroup(null)).toEqual({ primary: null, secondary: [] })
        expect(mapLegacyMuscleGroup('')).toEqual({ primary: null, secondary: [] })
        expect(mapLegacyMuscleGroup('bolí mě to')).toEqual({ primary: null, secondary: [] })
    })

    it('skips unrecognized entries inside a list and collapses repeats', () => {
        expect(mapLegacyMuscleGroup('nohy, něco, legs, hýždě')).toEqual({ primary: 'legs', secondary: ['glutes'] })
    })
})

describe('secondary Muscles', () => {
    it('parses the local JSON text and the remote array alike, dropping unknown keys and the primary', () => {
        expect(parseSecondaryMuscles('["triceps","nope","chest"]', 'chest')).toEqual(['triceps'])
        expect(parseSecondaryMuscles(['triceps', 'front_delts'])).toEqual(['triceps', 'front_delts'])
        expect(parseSecondaryMuscles('junk')).toEqual([])
        expect(parseSecondaryMuscles(null)).toEqual([])
    })

    it('keeps unknown stored keys as raw strings so a newer client’s values survive', () => {
        expect(parseStoredMuscleList('["triceps","tail",3,""]')).toEqual(['triceps', 'tail'])
        expect(parseStoredMuscleList(['tail'])).toEqual(['tail'])
    })

    it('serializes canonically', () => {
        expect(serializeSecondaryMuscles(['triceps', 'triceps', 'chest'], 'chest')).toBe('["triceps"]')
    })
})

describe('resolveExerciseMuscles', () => {
    it('prefers explicit taxonomy fields', () => {
        expect(
            resolveExerciseMuscles({
                primary_muscle: 'quads',
                secondary_muscles: '["glutes"]',
                muscle_group: 'legs',
            })
        ).toEqual({ primary: 'quads', secondary: ['glutes'] })
    })

    it('falls back to the legacy text for Exercises saved before the taxonomy', () => {
        expect(resolveExerciseMuscles({ primary_muscle: null, muscle_group: 'nohy' })).toEqual({
            primary: 'legs',
            secondary: [],
        })
    })

    it('lets a later edit from an older app version win over stale explicit keys', () => {
        // A taxonomy-aware client always mirrors the primary's group into
        // muscle_group; a different value there was written by an older client.
        const edited = { primary_muscle: 'quads', secondary_muscles: '["glutes"]', muscle_group: 'záda' }
        expect(resolveExerciseMuscles(edited)).toEqual({ primary: 'back', secondary: [] })
        expect(hasExplicitMuscles(edited)).toBe(false)
        expect(hasExplicitMuscles({ primary_muscle: 'quads', muscle_group: 'legs' })).toBe(true)
        expect(hasExplicitMuscles({ primary_muscle: 'quads', muscle_group: null })).toBe(true)
    })

    it('treats an unknown stored key as missing and falls back', () => {
        expect(resolveExerciseMuscles({ primary_muscle: 'neck', muscle_group: 'záda' }).primary).toBe('back')
    })

    it('resolves the Muscle Group an Exercise counts towards', () => {
        expect(resolveExerciseMuscleGroup({ primary_muscle: 'triceps' })).toBe('arms')
        expect(resolveExerciseMuscleGroup({ muscle_group: 'nonsense' })).toBeNull()
    })
})
