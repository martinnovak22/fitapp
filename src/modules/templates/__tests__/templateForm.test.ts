import { describe, expect, it } from 'vitest'
import { filterExercises, groupByMuscle, liveSelection, muscleGroupsOf, validateTemplate } from '../templateForm'

const ex = (uuid: string, name: string, muscle_group?: string) => ({ uuid, name, muscle_group })

describe('validateTemplate', () => {
    it('requires a name', () => {
        expect(validateTemplate({ name: '   ', exerciseUuids: ['a'] })).toEqual({
            ok: false,
            field: 'name',
            errorKey: 'templateNameRequired',
        })
    })

    it('requires at least one Exercise', () => {
        expect(validateTemplate({ name: 'Push', exerciseUuids: [] })).toMatchObject({ ok: false, field: 'exercises' })
    })

    it('returns the trimmed name when valid', () => {
        expect(validateTemplate({ name: ' Push ', exerciseUuids: ['a'] })).toEqual({
            ok: true,
            name: 'Push',
            exerciseUuids: ['a'],
        })
    })
})

describe('liveSelection', () => {
    it('drops selected uuids that no longer resolve and follows the Exercise-list order', () => {
        const exercises = [ex('a', 'A'), ex('b', 'B'), ex('c', 'C')]
        expect(liveSelection(new Set(['c', 'gone', 'a']), exercises)).toEqual(['a', 'c'])
    })
})

describe('filterExercises', () => {
    const list = [ex('1', 'Bench Press', 'hrudník'), ex('2', 'Dřep', 'nohy'), ex('3', 'Row')]

    it('matches names ignoring case and diacritics', () => {
        expect(filterExercises(list, 'drep').map((e) => e.uuid)).toEqual(['2'])
        expect(filterExercises(list, 'BENCH').map((e) => e.uuid)).toEqual(['1'])
    })

    it('matches the muscle group too', () => {
        expect(filterExercises(list, 'hrudnik').map((e) => e.uuid)).toEqual(['1'])
    })

    it('returns everything for a blank query', () => {
        expect(filterExercises(list, '  ')).toHaveLength(3)
    })
})

describe('groupByMuscle', () => {
    it('sorts groups alphabetically, keeps member order, and puts ungrouped last', () => {
        const list = [ex('1', 'Row', 'záda'), ex('2', 'Plank'), ex('3', 'Bench', 'hrudník'), ex('4', 'Pull-up', 'záda')]
        expect(groupByMuscle(list).map((g) => [g.group, g.exercises.map((e) => e.uuid)])).toEqual([
            ['hrudník', ['3']],
            ['záda', ['1', '4']],
            [null, ['2']],
        ])
    })

    it('summarizes distinct muscle groups', () => {
        expect(muscleGroupsOf([ex('1', 'A', 'záda'), ex('2', 'B', 'záda'), ex('3', 'C')])).toEqual(['záda'])
    })
})
