import type { SubSet, Workout, Set as WorkoutSet } from '@/src/db/workouts'
import type { SetFormValues } from './setPayload'
import { parseSubSets } from './workoutUtils'

type TimingField = 'timingDate' | 'timingStartTime' | 'timingEndTime'

const EMPTY_INPUTS: SetFormValues = {
    weight: '',
    reps: '',
    distance: '',
    durationMinutes: '',
    durationSeconds: '',
}

/**
 * Local UI progression for a workout session screen: which form/modal is open,
 * what set is being edited, the in-flight form values, history edit mode, and
 * the timing-edit form. Server/data state lives in `useWorkoutSession`; this
 * reducer owns only the screen's transient interaction state.
 */
export type SessionState = {
    modalVisible: boolean
    editingSetId: number | null
    selectedExerciseId: number | null
    subSets: SubSet[]
    isHistoryEditMode: boolean
    timingModalVisible: boolean
    timingDate: string
    timingStartTime: string
    timingEndTime: string
    inputValues: SetFormValues
}

export type SessionAction =
    | { type: 'SELECT_DEFAULT_EXERCISE'; exerciseId: number }
    | { type: 'SET_SELECTED_EXERCISE'; exerciseId: number | null }
    | { type: 'OPEN_ADD_MODAL' }
    | { type: 'OPEN_EDIT_MODAL'; set: WorkoutSet }
    | { type: 'CLOSE_MODAL' }
    | { type: 'SET_SAVE_SUCCEEDED' }
    | { type: 'UPDATE_INPUT'; key: keyof SetFormValues; value: string }
    | { type: 'SET_SUB_SETS'; subSets: SubSet[] }
    | { type: 'TOGGLE_HISTORY_EDIT_MODE' }
    | { type: 'OPEN_TIMING_MODAL'; date: string; startTime: string; endTime: string }
    | { type: 'SET_TIMING_FIELD'; field: TimingField; value: string }
    | { type: 'CLOSE_TIMING_MODAL' }

export const initialSessionState: SessionState = {
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
}

const formValuesFromSet = (set: WorkoutSet): SetFormValues => {
    let durationMinutes = ''
    let durationSeconds = ''
    if (set.duration) {
        durationMinutes = Math.floor(set.duration).toString()
        durationSeconds = Math.round((set.duration - Math.floor(set.duration)) * 60).toString()
    }

    return {
        weight: set.weight?.toString() || '',
        reps: set.reps?.toString() || '',
        distance: set.distance?.toString() || '',
        durationMinutes,
        durationSeconds,
    }
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
    switch (action.type) {
        case 'SELECT_DEFAULT_EXERCISE':
            if (state.selectedExerciseId) return state
            return { ...state, selectedExerciseId: action.exerciseId }

        case 'SET_SELECTED_EXERCISE':
            return { ...state, selectedExerciseId: action.exerciseId }

        case 'OPEN_ADD_MODAL':
            return {
                ...state,
                editingSetId: null,
                subSets: [],
                inputValues: EMPTY_INPUTS,
                modalVisible: true,
            }

        case 'OPEN_EDIT_MODAL':
            return {
                ...state,
                editingSetId: action.set.id,
                selectedExerciseId: action.set.exercise_id,
                subSets: parseSubSets(action.set.sub_sets),
                inputValues: formValuesFromSet(action.set),
                modalVisible: true,
            }

        case 'CLOSE_MODAL':
            return { ...state, modalVisible: false }

        case 'SET_SAVE_SUCCEEDED':
            return { ...state, modalVisible: false, editingSetId: null, subSets: [] }

        case 'UPDATE_INPUT':
            return { ...state, inputValues: { ...state.inputValues, [action.key]: action.value } }

        case 'SET_SUB_SETS':
            return { ...state, subSets: action.subSets }

        case 'TOGGLE_HISTORY_EDIT_MODE':
            return { ...state, isHistoryEditMode: !state.isHistoryEditMode }

        case 'OPEN_TIMING_MODAL':
            return {
                ...state,
                timingDate: action.date,
                timingStartTime: action.startTime,
                timingEndTime: action.endTime,
                timingModalVisible: true,
            }

        case 'SET_TIMING_FIELD':
            return { ...state, [action.field]: action.value }

        case 'CLOSE_TIMING_MODAL':
            return { ...state, timingModalVisible: false }

        default:
            return state
    }
}

export const isReadOnly = (workout: Workout | null, isHistoryEditMode: boolean): boolean =>
    workout?.status === 'finished' && !isHistoryEditMode

export const canFinishWorkout = (workout: Workout | null): boolean => workout?.status !== 'finished'

export const canEditFinishedWorkout = (workout: Workout | null): boolean => workout?.status === 'finished'
