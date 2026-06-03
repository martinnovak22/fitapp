import { describe, expect, it } from 'vitest'
import type { Set as WorkoutSet, Workout } from '@/src/db/workouts'
import {
    canEditHistoryWorkout,
    canFinishWorkout,
    initialSessionState,
    isReadOnly,
    sessionReducer,
    type SessionState,
} from '../workoutSessionReducer'

const EMPTY_INPUTS = {
    weight: '',
    reps: '',
    distance: '',
    durationMinutes: '',
    durationSeconds: '',
}

const makeSet = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
    id: 1,
    workout_id: 10,
    exercise_id: 5,
    position: 0,
    ...overrides,
})

const makeWorkout = (overrides: Partial<Workout> = {}): Workout => ({
    id: 10,
    date: '2026-01-01',
    start_time: '2026-01-01T08:00:00.000Z',
    status: 'in_progress',
    ...overrides,
})

describe('initialSessionState', () => {
    it('starts with closed modals, no editing target, and empty inputs', () => {
        expect(initialSessionState).toEqual<SessionState>({
            modalVisible: false,
            editingSetId: null,
            selectedExerciseId: null,
            subSets: [],
            isHistoryEditMode: false,
            timingModalVisible: false,
            timingDate: '',
            timingStartTime: '',
            timingEndTime: '',
            inputValues: EMPTY_INPUTS,
        })
    })
})

describe('sessionReducer — default exercise selection', () => {
    it('selects the default exercise only when none is selected', () => {
        const next = sessionReducer(initialSessionState, { type: 'SELECT_DEFAULT_EXERCISE', exerciseId: 7 })
        expect(next.selectedExerciseId).toBe(7)
    })

    it('does not override an already-selected exercise', () => {
        const state: SessionState = { ...initialSessionState, selectedExerciseId: 3 }
        const next = sessionReducer(state, { type: 'SELECT_DEFAULT_EXERCISE', exerciseId: 7 })
        expect(next).toBe(state)
    })

    it('sets the selected exercise explicitly', () => {
        const next = sessionReducer(initialSessionState, { type: 'SET_SELECTED_EXERCISE', exerciseId: 9 })
        expect(next.selectedExerciseId).toBe(9)
    })
})

describe('sessionReducer — opening the add modal', () => {
    it('clears editing target, subsets and inputs, then opens the modal', () => {
        const dirty: SessionState = {
            ...initialSessionState,
            editingSetId: 42,
            subSets: [{ weight: 10 }],
            inputValues: { ...EMPTY_INPUTS, weight: '50' },
        }
        const next = sessionReducer(dirty, { type: 'OPEN_ADD_MODAL' })
        expect(next.modalVisible).toBe(true)
        expect(next.editingSetId).toBeNull()
        expect(next.subSets).toEqual([])
        expect(next.inputValues).toEqual(EMPTY_INPUTS)
    })
})

describe('sessionReducer — opening the edit modal', () => {
    it('loads the set into the form, splitting duration into minutes and seconds', () => {
        const set = makeSet({
            id: 99,
            exercise_id: 8,
            weight: 60,
            reps: 12,
            distance: 5,
            duration: 1.5, // 1 min 30 sec
            sub_sets: JSON.stringify([{ weight: 20, reps: 5 }]),
        })
        const next = sessionReducer(initialSessionState, { type: 'OPEN_EDIT_MODAL', set })

        expect(next.modalVisible).toBe(true)
        expect(next.editingSetId).toBe(99)
        expect(next.selectedExerciseId).toBe(8)
        expect(next.subSets).toEqual([{ weight: 20, reps: 5 }])
        expect(next.inputValues).toEqual({
            weight: '60',
            reps: '12',
            distance: '5',
            durationMinutes: '1',
            durationSeconds: '30',
        })
    })

    it('leaves duration fields blank when the set has no duration', () => {
        const set = makeSet({ id: 5, exercise_id: 2, weight: 40 })
        const next = sessionReducer(initialSessionState, { type: 'OPEN_EDIT_MODAL', set })
        expect(next.inputValues.durationMinutes).toBe('')
        expect(next.inputValues.durationSeconds).toBe('')
        expect(next.inputValues.weight).toBe('40')
        expect(next.inputValues.reps).toBe('')
    })

    it('treats malformed sub_sets json as no subsets', () => {
        const set = makeSet({ sub_sets: 'not-json' })
        const next = sessionReducer(initialSessionState, { type: 'OPEN_EDIT_MODAL', set })
        expect(next.subSets).toEqual([])
    })
})

describe('sessionReducer — input editing', () => {
    it('updates a single input field without touching others', () => {
        const state: SessionState = { ...initialSessionState, inputValues: { ...EMPTY_INPUTS, reps: '5' } }
        const next = sessionReducer(state, { type: 'UPDATE_INPUT', key: 'weight', value: '80' })
        expect(next.inputValues.weight).toBe('80')
        expect(next.inputValues.reps).toBe('5')
    })

    it('replaces subsets', () => {
        const next = sessionReducer(initialSessionState, { type: 'SET_SUB_SETS', subSets: [{ reps: 3 }] })
        expect(next.subSets).toEqual([{ reps: 3 }])
    })
})

describe('sessionReducer — closing modals', () => {
    it('closes the set modal but keeps form values', () => {
        const state: SessionState = {
            ...initialSessionState,
            modalVisible: true,
            inputValues: { ...EMPTY_INPUTS, weight: '70' },
        }
        const next = sessionReducer(state, { type: 'CLOSE_MODAL' })
        expect(next.modalVisible).toBe(false)
        expect(next.inputValues.weight).toBe('70')
    })

    it('resets editing target and subsets after a successful save', () => {
        const state: SessionState = {
            ...initialSessionState,
            modalVisible: true,
            editingSetId: 12,
            subSets: [{ weight: 1 }],
        }
        const next = sessionReducer(state, { type: 'SET_SAVE_SUCCEEDED' })
        expect(next.modalVisible).toBe(false)
        expect(next.editingSetId).toBeNull()
        expect(next.subSets).toEqual([])
    })
})

describe('sessionReducer — history edit mode', () => {
    it('toggles history edit mode', () => {
        const on = sessionReducer(initialSessionState, { type: 'TOGGLE_HISTORY_EDIT_MODE' })
        expect(on.isHistoryEditMode).toBe(true)
        const off = sessionReducer(on, { type: 'TOGGLE_HISTORY_EDIT_MODE' })
        expect(off.isHistoryEditMode).toBe(false)
    })
})

describe('sessionReducer — timing modal', () => {
    it('opens the timing modal seeded from the workout', () => {
        const next = sessionReducer(initialSessionState, {
            type: 'OPEN_TIMING_MODAL',
            date: '2026-01-01',
            startTime: '08:00',
            endTime: '09:30',
        })
        expect(next.timingModalVisible).toBe(true)
        expect(next.timingDate).toBe('2026-01-01')
        expect(next.timingStartTime).toBe('08:00')
        expect(next.timingEndTime).toBe('09:30')
    })

    it('updates individual timing fields', () => {
        const open = sessionReducer(initialSessionState, {
            type: 'OPEN_TIMING_MODAL',
            date: '2026-01-01',
            startTime: '08:00',
            endTime: '',
        })
        const next = sessionReducer(open, { type: 'SET_TIMING_FIELD', field: 'timingEndTime', value: '10:15' })
        expect(next.timingEndTime).toBe('10:15')
        expect(next.timingStartTime).toBe('08:00')
    })

    it('closes the timing modal', () => {
        const open = sessionReducer(initialSessionState, {
            type: 'OPEN_TIMING_MODAL',
            date: '2026-01-01',
            startTime: '08:00',
            endTime: '',
        })
        const next = sessionReducer(open, { type: 'CLOSE_TIMING_MODAL' })
        expect(next.timingModalVisible).toBe(false)
    })
})

describe('derived flags', () => {
    it('isReadOnly is true for a finished workout not in edit mode', () => {
        const workout = makeWorkout({ status: 'finished' })
        expect(isReadOnly(workout, false)).toBe(true)
        expect(isReadOnly(workout, true)).toBe(false)
    })

    it('isReadOnly is false for an in-progress workout', () => {
        expect(isReadOnly(makeWorkout({ status: 'in_progress' }), false)).toBe(false)
    })

    it('canFinishWorkout is true only when the workout is not finished', () => {
        expect(canFinishWorkout(makeWorkout({ status: 'in_progress' }))).toBe(true)
        expect(canFinishWorkout(makeWorkout({ status: 'finished' }))).toBe(false)
        expect(canFinishWorkout(null)).toBe(true)
    })

    it('canEditHistoryWorkout is true only for a finished workout opened from history', () => {
        const finished = makeWorkout({ status: 'finished' })
        expect(canEditHistoryWorkout('history', finished)).toBe(true)
        expect(canEditHistoryWorkout('workout', finished)).toBe(false)
        expect(canEditHistoryWorkout('history', makeWorkout({ status: 'in_progress' }))).toBe(false)
        expect(canEditHistoryWorkout('history', null)).toBe(false)
    })
})
