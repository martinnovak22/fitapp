import { describe, expect, it } from 'vitest'
import { resolveTemplatePriority } from '../plannedExercises'

const bench = { id: 1, uuid: 'ex-bench' }
const squat = { id: 2, uuid: 'ex-squat' }
const row = { id: 3, uuid: 'ex-row' }
const exercises = [bench, squat, row]

describe('resolveTemplatePriority', () => {
    it('leads with nothing for an Unplanned Workout', () => {
        expect(resolveTemplatePriority({ exercises, templateUuid: null, template: null })).toEqual({
            templateName: null,
            priorityUuids: [],
        })
    })

    it("leads with the Template's Exercises, in the user's Exercise order", () => {
        expect(
            resolveTemplatePriority({
                exercises,
                templateUuid: 't-push',
                template: { name: 'Push', exercise_uuids: ['ex-row', 'ex-bench'] },
            })
        ).toEqual({ templateName: 'Push', priorityUuids: ['ex-bench', 'ex-row'] })
    })

    it('skips Template members that are not on this device', () => {
        expect(
            resolveTemplatePriority({
                exercises,
                templateUuid: 't-push',
                template: { name: 'Push', exercise_uuids: ['ex-gone', 'ex-squat'] },
            }).priorityUuids
        ).toEqual(['ex-squat'])
    })

    it('leads with nothing when the Template was deleted', () => {
        expect(resolveTemplatePriority({ exercises, templateUuid: 't-gone', template: null })).toEqual({
            templateName: null,
            priorityUuids: [],
        })
    })
})
