import { describe, expect, it } from 'vitest'
import { filterExercises, groupByMuscle, muscleGroupsOf, validateTemplate } from '../templateForm'

const ex = (uuid: string, name: string, muscle_group?: string) => ({ uuid, name, muscle_group })

describe('validateTemplate', () => {
    it('requires a name', () => {
        expect(validateTemplate({ name: '   ', exerciseUuids: ['a'], liveMemberCount: 1 })).toEqual({
            ok: false,
            field: 'name',
            errorKey: 'templateNameRequired',
        })
    })

    it('requires at least one live Exercise, ignoring members not on this device', () => {
        expect(validateTemplate({ name: 'Push', exerciseUuids: ['not-here'], liveMemberCount: 0 })).toMatchObject({
            ok: false,
            field: 'exercises',
        })
    })

    it('keeps the whole selection, including members not on this device yet', () => {
        expect(validateTemplate({ name: ' Push ', exerciseUuids: ['a', 'not-here'], liveMemberCount: 1 })).toEqual({
            ok: true,
            name: 'Push',
            exerciseUuids: ['a', 'not-here'],
        })
    })
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
