import { describe, expect, it } from 'vitest'
import { resolvePickerExercises, resolveTemplateExercises } from '../plannedExercises'

const bench = { id: 1, uuid: 'ex-bench' }
const squat = { id: 2, uuid: 'ex-squat' }
const row = { id: 3, uuid: 'ex-row' }
const exercises = [bench, squat, row]

describe('resolveTemplateExercises', () => {
    it('keeps Exercise-list order and skips uuids that no longer resolve', () => {
        const template = { exercise_uuids: ['ex-row', 'ex-deleted', 'ex-bench'] }
        expect(resolveTemplateExercises(template, exercises)).toEqual([bench, row])
    })
})

describe('resolvePickerExercises', () => {
    it('offers every Exercise to an Unplanned Workout', () => {
        const result = resolvePickerExercises({ exercises, templateUuid: null, template: null, loggedExerciseIds: [] })
        expect(result).toEqual({ exercises, scope: { kind: 'unplanned' } })
    })

    it('offers only the Template’s Exercises to a Planned Workout', () => {
        const result = resolvePickerExercises({
            exercises,
            templateUuid: 't-push',
            template: { name: 'Push', exercise_uuids: ['ex-bench'] },
            loggedExerciseIds: [],
        })
        expect(result).toEqual({ exercises: [bench], scope: { kind: 'planned', templateName: 'Push' } })
    })

    it('keeps an already-logged Exercise selectable after it left the Template', () => {
        const result = resolvePickerExercises({
            exercises,
            templateUuid: 't-push',
            template: { name: 'Push', exercise_uuids: ['ex-bench'] },
            loggedExerciseIds: [row.id],
        })
        expect(result.exercises).toEqual([bench, row])
    })

    it('falls back to every Exercise when the Template was deleted', () => {
        const result = resolvePickerExercises({
            exercises,
            templateUuid: 't-gone',
            template: null,
            loggedExerciseIds: [],
        })
        expect(result).toEqual({ exercises, scope: { kind: 'planned-fallback', templateName: null } })
    })

    it('falls back to every Exercise when none of the Template’s Exercises are left', () => {
        const result = resolvePickerExercises({
            exercises,
            templateUuid: 't-push',
            template: { name: 'Push', exercise_uuids: ['ex-deleted'] },
            loggedExerciseIds: [],
        })
        expect(result).toEqual({ exercises, scope: { kind: 'planned-fallback', templateName: 'Push' } })
    })
})
