import { describe, expect, it } from 'vitest'
import {
    buildPickerSections,
    filterByFacets,
    filterExercises,
    groupByMuscle,
    muscleGroupsOf,
    NO_FACETS,
} from '../exerciseFilters'

const ex = (uuid: string, name: string, muscle_group?: string, equipment?: string) => ({
    uuid,
    name,
    muscle_group,
    equipment,
})

describe('filterExercises', () => {
    const list = [ex('1', 'Bench Press', 'hrudník'), ex('2', 'Dřep', 'nohy'), ex('3', 'Row')]

    it('matches names ignoring case and diacritics', () => {
        expect(filterExercises(list, 'drep').map((e) => e.uuid)).toEqual(['2'])
        expect(filterExercises(list, 'BENCH').map((e) => e.uuid)).toEqual(['1'])
    })

    it('matches the legacy muscle text and caller-supplied labels', () => {
        expect(filterExercises(list, 'hrudnik').map((e) => e.uuid)).toEqual(['1'])
        expect(filterExercises(list, 'zada', (e) => (e.uuid === '3' ? ['Záda'] : [])).map((e) => e.uuid)).toEqual(['3'])
    })

    it('returns everything for a blank query', () => {
        expect(filterExercises(list, '  ')).toHaveLength(3)
    })
})

describe('groupByMuscle', () => {
    it('sections by Muscle Group in taxonomy order, keeps member order, and puts unclassified last', () => {
        const list = [
            ex('1', 'Row', 'záda'),
            ex('2', 'Plank', 'nonsense'),
            { ...ex('3', 'Pushdown'), primary_muscle: 'triceps' as const },
            ex('4', 'Pull-up', 'back'),
            ex('5', 'Bench', 'hrudník'),
        ]
        expect(groupByMuscle(list).map((g) => [g.group, g.exercises.map((e) => e.uuid)])).toEqual([
            ['chest', ['5']],
            ['back', ['1', '4']],
            ['arms', ['3']],
            [null, ['2']],
        ])
    })

    it('summarizes distinct Muscle Groups', () => {
        expect(muscleGroupsOf([ex('1', 'A', 'záda'), ex('2', 'B', 'lats'), ex('3', 'C')])).toEqual(['back'])
    })
})

describe('filterByFacets', () => {
    const list = [
        ex('1', 'Bench', 'chest', 'barbell'),
        ex('2', 'Fly', 'chest', 'dumbbell'),
        ex('3', 'Curl', 'biceps', 'dumbbell'),
        ex('4', 'Odd', 'chest', 'spaceship'),
    ]

    it('keeps everything without facets', () => {
        expect(filterByFacets(list, NO_FACETS)).toHaveLength(4)
    })

    it('narrows by Muscle Group, Equipment, or both', () => {
        expect(filterByFacets(list, { muscleGroup: 'chest', equipment: null }).map((e) => e.uuid)).toEqual([
            '1',
            '2',
            '4',
        ])
        expect(filterByFacets(list, { muscleGroup: null, equipment: 'dumbbell' }).map((e) => e.uuid)).toEqual([
            '2',
            '3',
        ])
        expect(filterByFacets(list, { muscleGroup: 'chest', equipment: 'dumbbell' }).map((e) => e.uuid)).toEqual(['2'])
    })
})

describe('buildPickerSections', () => {
    const list = [ex('1', 'Bench', 'chest'), ex('2', 'Row', 'back'), ex('3', 'Fly', 'chest')]

    it('groups by Muscle Group without priority Exercises', () => {
        expect(buildPickerSections(list).map((s) => [s.key, s.exercises.map((e) => e.uuid)])).toEqual([
            ['chest', ['1', '3']],
            ['back', ['2']],
        ])
    })

    it('lists priority Exercises first and only once', () => {
        const sections = buildPickerSections(list, ['3', 'missing'])
        expect(sections.map((s) => [s.key, s.isPriority, s.exercises.map((e) => e.uuid)])).toEqual([
            ['__priority', true, ['3']],
            ['chest', false, ['1']],
            ['back', false, ['2']],
        ])
    })
})
