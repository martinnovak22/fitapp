import { describe, expect, it } from 'vitest'
import type { ExerciseType } from '@/src/db/exercises'
import type { HistorySet, Set as WorkoutSet } from '@/src/db/workouts'
import {
    buildBlocks,
    countPendingRows,
    countPersonalRecords,
    type DraftRow,
    draftReducer,
    EMPTY_DRAFT,
    EMPTY_VALUES,
    formatElapsed,
    formatPrevious,
    mergeLoggedEdit,
    parseDraft,
    performedBefore,
    pickPreviousSets,
    prefillRow,
    rowPayload,
    valuesFromSet,
    type WorkoutDraft,
    workoutDurationMinutes,
    workoutVolume,
} from '../liveWorkout'

const set = (overrides: Partial<WorkoutSet>): WorkoutSet => ({
    id: 1,
    workout_id: 1,
    exercise_id: 1,
    position: 0,
    ...overrides,
})

const row = (key: string, values: Partial<typeof EMPTY_VALUES> = {}): DraftRow => ({
    key,
    values: { ...EMPTY_VALUES, ...values },
    subSets: null,
})

describe('valuesFromSet', () => {
    it('shows numbers as text and splits duration into minutes and seconds', () => {
        expect(valuesFromSet({ weight: 62.5, reps: 8, duration: 1.5 })).toEqual({
            weight: '62.5',
            reps: '8',
            distance: '',
            durationMinutes: '1',
            durationSeconds: '30',
        })
    })

    it('leaves missing metrics empty and keeps an explicit zero', () => {
        expect(valuesFromSet({ weight: 0 })).toMatchObject({ weight: '0', reps: '', durationMinutes: '' })
    })
})

describe('mergeLoggedEdit', () => {
    it('keeps the stored value of a field cleared to nothing', () => {
        const stored = { ...EMPTY_VALUES, weight: '60', reps: '8' }
        expect(mergeLoggedEdit(stored, { ...stored, weight: ' ', reps: '10' })).toEqual({
            ...stored,
            weight: '60',
            reps: '10',
        })
    })

    it('lets a field that was empty stay empty and works for drop stages', () => {
        expect(mergeLoggedEdit({ weight: '20', reps: '' }, { weight: '', reps: '' })).toEqual({
            weight: '20',
            reps: '',
        })
    })
})

describe('parseDraft', () => {
    it('reads back what was stored', () => {
        const draft: WorkoutDraft = {
            version: 1,
            exerciseOrder: [3, 1],
            rows: { 3: [{ key: 'a', values: { ...EMPTY_VALUES, reps: '5' }, subSets: [{ weight: '20', reps: '' }] }] },
        }
        expect(parseDraft(JSON.stringify(draft))).toEqual(draft)
    })

    it('turns junk, other versions and missing values into an empty draft', () => {
        expect(parseDraft(null)).toEqual(EMPTY_DRAFT)
        expect(parseDraft('{oops')).toEqual(EMPTY_DRAFT)
        expect(parseDraft(JSON.stringify({ version: 2 }))).toEqual(EMPTY_DRAFT)
    })

    it('drops malformed rows and de-duplicates the order', () => {
        const parsed = parseDraft(
            JSON.stringify({ version: 1, exerciseOrder: [1, 1, 'x'], rows: { 1: [{ nope: true }, { key: 'k' }] } })
        )
        expect(parsed.exerciseOrder).toEqual([1])
        expect(parsed.rows[1]).toEqual([{ key: 'k', values: EMPTY_VALUES, subSets: null }])
    })
})

describe('draftReducer', () => {
    it('adds new exercises with their rows and ignores ones already added', () => {
        const once = draftReducer(EMPTY_DRAFT, {
            type: 'addExercises',
            exerciseIds: [1, 2],
            rowsFor: (id) => [row(`r${id}`)],
        })
        const twice = draftReducer(once, { type: 'addExercises', exerciseIds: [2, 3], rowsFor: () => [] })
        expect(twice.exerciseOrder).toEqual([1, 2, 3])
        expect(twice.rows[2]).toEqual([row('r2')])
    })

    it('edits one value of one row', () => {
        const draft = draftReducer(EMPTY_DRAFT, { type: 'addRow', exerciseId: 1, row: row('a') })
        const next = draftReducer(draft, { type: 'updateValue', exerciseId: 1, key: 'a', field: 'reps', value: '9' })
        expect(next.rows[1][0].values.reps).toBe('9')
        expect(next.exerciseOrder).toEqual([1])
    })

    it('turns a row into a drop set and back, collapsing when the last stage goes', () => {
        let draft = draftReducer(EMPTY_DRAFT, { type: 'addRow', exerciseId: 1, row: row('a') })
        draft = draftReducer(draft, { type: 'toggleDrop', exerciseId: 1, key: 'a' })
        expect(draft.rows[1][0].subSets).toEqual([{ weight: '', reps: '' }])
        draft = draftReducer(draft, { type: 'addSubSet', exerciseId: 1, key: 'a' })
        draft = draftReducer(draft, {
            type: 'updateSubSet',
            exerciseId: 1,
            key: 'a',
            index: 1,
            field: 'weight',
            value: '15',
        })
        expect(draft.rows[1][0].subSets).toEqual([
            { weight: '', reps: '' },
            { weight: '15', reps: '' },
        ])
        draft = draftReducer(draft, { type: 'removeSubSet', exerciseId: 1, key: 'a', index: 0 })
        draft = draftReducer(draft, { type: 'removeSubSet', exerciseId: 1, key: 'a', index: 0 })
        expect(draft.rows[1][0].subSets).toBeNull()
    })

    it('removes a row and a whole exercise', () => {
        let draft = draftReducer(EMPTY_DRAFT, { type: 'addRow', exerciseId: 1, row: row('a') })
        draft = draftReducer(draft, { type: 'addRow', exerciseId: 1, row: row('b') })
        draft = draftReducer(draft, { type: 'removeRow', exerciseId: 1, key: 'a' })
        expect(draft.rows[1].map((r) => r.key)).toEqual(['b'])
        draft = draftReducer(draft, { type: 'removeExercise', exerciseId: 1 })
        expect(draft).toEqual(EMPTY_DRAFT)
    })

    it('replaces all values of a row and loads a stored draft as is', () => {
        const draft = draftReducer(EMPTY_DRAFT, { type: 'addRow', exerciseId: 1, row: row('a', { reps: '3' }) })
        const values = { ...EMPTY_VALUES, weight: '80', reps: '5' }
        expect(draftReducer(draft, { type: 'setValues', exerciseId: 1, key: 'a', values }).rows[1][0].values).toBe(
            values
        )
        const stored: WorkoutDraft = { version: 1, exerciseOrder: [4], rows: { 4: [row('z')] } }
        expect(draftReducer(draft, { type: 'load', draft: stored })).toBe(stored)
    })

    it('leaves the draft untouched when the row is unknown', () => {
        const draft = draftReducer(EMPTY_DRAFT, { type: 'addRow', exerciseId: 1, row: row('a') })
        expect(draftReducer(draft, { type: 'toggleDrop', exerciseId: 1, key: 'zzz' })).toBe(draft)
    })
})

describe('countPendingRows', () => {
    it('counts only rows with something entered', () => {
        const draft: WorkoutDraft = {
            version: 1,
            exerciseOrder: [1],
            rows: {
                1: [row('a'), row('b', { reps: '5' }), { ...row('c'), subSets: [{ weight: '10', reps: '' }] }],
            },
        }
        expect(countPendingRows(draft)).toBe(2)
    })

    it('counts only the given Exercises', () => {
        const draft: WorkoutDraft = {
            version: 1,
            exerciseOrder: [1, 2],
            rows: { 1: [row('a', { reps: '5' })], 2: [row('b', { weight: '20' }), row('c')] },
        }
        expect(countPendingRows(draft, new Set([2]))).toBe(1)
        expect(countPendingRows(draft, new Set())).toBe(0)
    })
})

describe('buildBlocks', () => {
    it('keeps the draft order and puts exercises logged outside it first', () => {
        const logged = [set({ id: 1, exercise_id: 7 }), set({ id: 2, exercise_id: 3 }), set({ id: 3, exercise_id: 7 })]
        const draft: WorkoutDraft = { version: 1, exerciseOrder: [9, 3], rows: { 9: [row('x')], 3: [row('y')] } }
        const blocks = buildBlocks(logged, draft)
        expect(blocks.map((b) => [b.exerciseId, b.logged.map((s) => s.id), b.drafts.map((r) => r.key)])).toEqual([
            [7, [1, 3], []],
            [9, [], ['x']],
            [3, [2], ['y']],
        ])
    })
})

describe('pickPreviousSets', () => {
    const history = (overrides: Partial<HistorySet>): HistorySet => ({
        ...set({}),
        workout_date: '2026-10-01',
        workout_start: '2026-10-01T10:00:00Z',
        ...overrides,
    })

    it('takes the latest workout per exercise, sets in position order', () => {
        const rows = [
            history({ id: 1, workout_id: 1, exercise_id: 5, position: 0, weight: 50 }),
            history({ id: 2, workout_id: 2, exercise_id: 5, position: 3, weight: 60, workout_date: '2026-10-03' }),
            history({ id: 3, workout_id: 2, exercise_id: 5, position: 1, weight: 55, workout_date: '2026-10-03' }),
            history({ id: 4, workout_id: 1, exercise_id: 6, position: 0, weight: 20 }),
        ]
        const previous = pickPreviousSets(rows)
        expect(previous.get(5)?.map((s) => s.weight)).toEqual([55, 60])
        expect(previous.get(6)?.map((s) => s.weight)).toEqual([20])
        expect(previous.get(5)?.[0]).not.toHaveProperty('workout_date')
    })
})

describe('performedBefore', () => {
    const at = (workout_date: string, workout_start: string) => ({ workout_date, workout_start })

    it('keeps only Workouts that started before the given one', () => {
        const rows = [
            at('2026-09-01', '2026-09-01T08:00:00Z'),
            at('2026-09-10', '2026-09-10T07:00:00Z'),
            at('2026-09-10', '2026-09-10T18:00:00Z'),
            at('2026-09-20', '2026-09-20T08:00:00Z'),
        ]
        expect(performedBefore(rows, '2026-09-10', '2026-09-10T12:00:00Z')).toEqual(rows.slice(0, 2))
    })
})

describe('formatPrevious', () => {
    it('shows last time compactly and a dash when there was none', () => {
        expect(formatPrevious('weight', set({ weight: 60, reps: 8 }))).toMatch(/60.*8/)
        expect(formatPrevious('weight', undefined)).toBe('—')
    })
})

describe('prefillRow', () => {
    const previous = [set({ weight: 60, reps: 8 }), set({ weight: 60, reps: 6 })]

    it('copies the matching set of last time', () => {
        expect(prefillRow(previous, 1, null)).toMatchObject({ weight: '60', reps: '6' })
    })

    it('falls back to the row above, then to empty', () => {
        const above = { ...EMPTY_VALUES, weight: '70', reps: '5' }
        expect(prefillRow(previous, 2, above)).toBe(above)
        expect(prefillRow([], 0, null)).toEqual(EMPTY_VALUES)
    })
})

describe('rowPayload', () => {
    it('builds a drop set from its stages', () => {
        const { data, hasAnyData } = rowPayload('weight', { ...EMPTY_VALUES, weight: '60', reps: '8' }, [
            { weight: '40', reps: '6' },
        ])
        expect(hasAnyData).toBe(true)
        expect(data).toMatchObject({ weight: 60, reps: 8 })
        expect(JSON.parse(data.sub_sets ?? '[]')).toEqual([{ weight: 40, reps: 6 }])
    })
})

describe('workoutVolume', () => {
    const typeOf = (id: number): ExerciseType | undefined => ({ 1: 'weight', 2: 'bodyweight' })[id] as ExerciseType

    it('sums weight × reps of weight sets including drop stages', () => {
        const sets = [
            set({ exercise_id: 1, weight: 60, reps: 8 }),
            set({ exercise_id: 1, weight: 50, reps: 5, sub_sets: JSON.stringify([{ weight: 30, reps: 10 }]) }),
            set({ exercise_id: 2, weight: 10, reps: 10 }),
        ]
        expect(workoutVolume(sets, typeOf)).toBe(480 + 250 + 300)
    })
})

describe('countPersonalRecords', () => {
    const typeOf = (): ExerciseType => 'weight'

    it('counts exercises whose best set beats every earlier set', () => {
        const current = [set({ exercise_id: 1, weight: 100, reps: 5 }), set({ exercise_id: 2, weight: 40, reps: 8 })]
        const earlier = [set({ exercise_id: 1, weight: 95, reps: 5 }), set({ exercise_id: 2, weight: 40, reps: 8 })]
        expect(countPersonalRecords(current, earlier, typeOf)).toBe(1)
    })

    it('does not count a first-ever performance', () => {
        expect(countPersonalRecords([set({ weight: 100, reps: 1 })], [], typeOf)).toBe(0)
    })
})

describe('workoutDurationMinutes', () => {
    it('rounds to whole minutes and is zero without an end', () => {
        expect(workoutDurationMinutes('2026-10-05T10:00:00Z', '2026-10-05T10:42:40Z')).toBe(43)
        expect(workoutDurationMinutes('2026-10-05T10:00:00Z', undefined)).toBe(0)
    })
})

describe('formatElapsed', () => {
    it('shows m:ss under an hour and h:mm:ss above', () => {
        expect(formatElapsed(65_000)).toBe('1:05')
        expect(formatElapsed(3_725_000)).toBe('1:02:05')
        expect(formatElapsed(-5)).toBe('0:00')
    })
})
