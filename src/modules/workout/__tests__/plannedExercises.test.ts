import { describe, expect, it } from 'vitest'
import { pickerCaption, resolveAddSelection, resolvePickerExercises } from '../plannedExercises'

const bench = { id: 1, uuid: 'ex-bench' }
const squat = { id: 2, uuid: 'ex-squat' }
const row = { id: 3, uuid: 'ex-row' }
const exercises = [bench, squat, row]

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

describe('resolveAddSelection', () => {
    it('keeps the remembered Exercise while the picker still offers it', () => {
        expect(resolveAddSelection(squat.id, [bench, squat])).toBe(squat.id)
    })

    it('lands on the first offered Exercise once the remembered one dropped out', () => {
        expect(resolveAddSelection(row.id, [bench, squat])).toBe(bench.id)
    })

    it('picks nothing when nothing is offered', () => {
        expect(resolveAddSelection(null, [])).toBeNull()
    })
})

describe('pickerCaption', () => {
    it('names the plan for a Planned Workout and explains the fallback', () => {
        expect(pickerCaption({ kind: 'planned', templateName: 'Push' })).toEqual({
            key: 'pickerFromPlan',
            name: 'Push',
        })
        expect(pickerCaption({ kind: 'planned-fallback', templateName: null })).toEqual({ key: 'pickerPlanFallback' })
        expect(pickerCaption({ kind: 'unplanned' })).toBeNull()
    })
})
