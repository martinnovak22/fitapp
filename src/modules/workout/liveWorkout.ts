// Pure model behind the live workout screen: the device-local draft of
// unchecked set rows, pre-filling rows from previous performance, and the
// numbers on the finish summary (volume, personal records). Only a checked
// (✓) row becomes a Set; drafts never sync (owner decision, UI plan §2).

import type { ExerciseType } from '@/src/db/exercises'
import type { HistorySet, SubSet, Set as WorkoutSet } from '@/src/db/workouts'
import {
    bestSetComparatorFor,
    ExerciseTypeMetadata,
    formatCompactSetLabel,
    getSetMetricValue,
} from '@/src/modules/exercises/ExerciseTypeMetadata'
import { buildSetPayload, type SetFormValues } from './setPayload'
import { parseSubSets } from './workoutUtils'

// --- Values -------------------------------------------------------------------

export const EMPTY_VALUES: SetFormValues = {
    weight: '',
    reps: '',
    distance: '',
    durationMinutes: '',
    durationSeconds: '',
}

export type SubSetValues = { weight: string; reps: string }

const numberText = (value: number | null | undefined): string =>
    value === null || value === undefined ? '' : String(Math.round(value * 100) / 100)

// A stored Set as the strings its row's inputs show. Duration is stored in
// minutes and shown as whole minutes plus seconds.
export const valuesFromSet = (set: Pick<WorkoutSet, 'weight' | 'reps' | 'distance' | 'duration'>): SetFormValues => {
    let durationMinutes = ''
    let durationSeconds = ''
    if (set.duration !== null && set.duration !== undefined) {
        const totalSeconds = Math.round(set.duration * 60)
        durationMinutes = String(Math.floor(totalSeconds / 60))
        durationSeconds = String(totalSeconds % 60).padStart(2, '0')
    }
    return {
        weight: numberText(set.weight),
        reps: numberText(set.reps),
        distance: numberText(set.distance),
        durationMinutes,
        durationSeconds,
    }
}

// An edit of a logged Set: a field cleared to nothing keeps the stored value,
// since an empty input would otherwise show blank while the Set keeps it.
export const mergeLoggedEdit = <V extends Record<string, string>>(stored: V, edited: V): V => {
    const merged = { ...edited }
    for (const key of Object.keys(stored) as (keyof V)[]) {
        if (edited[key].trim() === '' && stored[key] !== '') merged[key] = stored[key]
    }
    return merged
}

export const subSetValuesFrom = (subSets: readonly SubSet[]): SubSetValues[] =>
    subSets.map((subSet) => ({ weight: numberText(subSet.weight), reps: numberText(subSet.reps) }))

const parseNumber = (value: string): number | undefined => {
    const parsed = parseFloat(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : undefined
}

const subSetsFromValues = (values: readonly SubSetValues[]): SubSet[] =>
    values.map((value) => ({ weight: parseNumber(value.weight), reps: parseNumber(value.reps) }))

// --- Draft --------------------------------------------------------------------

export type DraftRow = {
    key: string
    values: SetFormValues
    // null for a normal set; the drop stages for a drop / pyramid set.
    subSets: SubSetValues[] | null
}

export type WorkoutDraft = {
    version: 1
    // Exercises added to the workout, in block order. Exercises that already
    // have logged Sets are listed too, so their block keeps its place.
    exerciseOrder: number[]
    // Unchecked rows per Exercise id.
    rows: Record<string, DraftRow[]>
}

export const EMPTY_DRAFT: WorkoutDraft = { version: 1, exerciseOrder: [], rows: {} }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const asText = (value: unknown): string => (typeof value === 'string' ? value : '')

const parseValues = (raw: unknown): SetFormValues => {
    const source = isRecord(raw) ? raw : {}
    return {
        weight: asText(source.weight),
        reps: asText(source.reps),
        distance: asText(source.distance),
        durationMinutes: asText(source.durationMinutes),
        durationSeconds: asText(source.durationSeconds),
    }
}

const parseRow = (raw: unknown): DraftRow | null => {
    if (!isRecord(raw) || typeof raw.key !== 'string') return null
    const subSets = Array.isArray(raw.subSets)
        ? raw.subSets.map((sub) => {
              const source = isRecord(sub) ? sub : {}
              return { weight: asText(source.weight), reps: asText(source.reps) }
          })
        : null
    return { key: raw.key, values: parseValues(raw.values), subSets }
}

// Tolerates whatever is in storage (an older shape, a half-written value,
// junk): anything unreadable becomes an empty draft rather than a crash.
export const parseDraft = (json: string | null | undefined): WorkoutDraft => {
    if (!json) return EMPTY_DRAFT
    try {
        const parsed: unknown = JSON.parse(json)
        if (!isRecord(parsed) || parsed.version !== 1) return EMPTY_DRAFT
        const exerciseOrder = Array.isArray(parsed.exerciseOrder)
            ? parsed.exerciseOrder.filter((id): id is number => Number.isInteger(id))
            : []
        const rows: Record<string, DraftRow[]> = {}
        if (isRecord(parsed.rows)) {
            for (const [exerciseId, list] of Object.entries(parsed.rows)) {
                if (!Array.isArray(list)) continue
                rows[exerciseId] = list.flatMap((row) => {
                    const parsedRow = parseRow(row)
                    return parsedRow ? [parsedRow] : []
                })
            }
        }
        return { version: 1, exerciseOrder: [...new Set(exerciseOrder)], rows }
    } catch {
        return EMPTY_DRAFT
    }
}

export type DraftAction =
    | { type: 'load'; draft: WorkoutDraft }
    | { type: 'addExercises'; exerciseIds: number[]; rowsFor: (exerciseId: number) => DraftRow[] }
    | { type: 'removeExercise'; exerciseId: number }
    | { type: 'addRow'; exerciseId: number; row: DraftRow }
    | { type: 'removeRow'; exerciseId: number; key: string }
    | { type: 'updateValue'; exerciseId: number; key: string; field: keyof SetFormValues; value: string }
    | { type: 'setValues'; exerciseId: number; key: string; values: SetFormValues }
    | { type: 'toggleDrop'; exerciseId: number; key: string }
    | { type: 'addSubSet'; exerciseId: number; key: string }
    | { type: 'removeSubSet'; exerciseId: number; key: string; index: number }
    | { type: 'updateSubSet'; exerciseId: number; key: string; index: number; field: keyof SubSetValues; value: string }

const EMPTY_SUB_SET: SubSetValues = { weight: '', reps: '' }

const mapRow = (
    draft: WorkoutDraft,
    exerciseId: number,
    key: string,
    update: (row: DraftRow) => DraftRow
): WorkoutDraft => {
    const list = draft.rows[exerciseId] ?? []
    if (!list.some((row) => row.key === key)) return draft
    return {
        ...draft,
        rows: { ...draft.rows, [exerciseId]: list.map((row) => (row.key === key ? update(row) : row)) },
    }
}

export const draftReducer = (draft: WorkoutDraft, action: DraftAction): WorkoutDraft => {
    switch (action.type) {
        case 'load':
            return action.draft
        case 'addExercises': {
            const added = action.exerciseIds.filter((id) => !draft.exerciseOrder.includes(id))
            if (added.length === 0) return draft
            const rows = { ...draft.rows }
            for (const id of added) rows[id] = action.rowsFor(id)
            return { ...draft, exerciseOrder: [...draft.exerciseOrder, ...added], rows }
        }
        case 'removeExercise': {
            const { [action.exerciseId]: _removed, ...rows } = draft.rows
            return { ...draft, exerciseOrder: draft.exerciseOrder.filter((id) => id !== action.exerciseId), rows }
        }
        case 'addRow':
            return {
                ...draft,
                exerciseOrder: draft.exerciseOrder.includes(action.exerciseId)
                    ? draft.exerciseOrder
                    : [...draft.exerciseOrder, action.exerciseId],
                rows: { ...draft.rows, [action.exerciseId]: [...(draft.rows[action.exerciseId] ?? []), action.row] },
            }
        case 'removeRow': {
            const list = draft.rows[action.exerciseId] ?? []
            return { ...draft, rows: { ...draft.rows, [action.exerciseId]: list.filter((r) => r.key !== action.key) } }
        }
        case 'updateValue':
            return mapRow(draft, action.exerciseId, action.key, (row) => ({
                ...row,
                values: { ...row.values, [action.field]: action.value },
            }))
        case 'setValues':
            return mapRow(draft, action.exerciseId, action.key, (row) => ({ ...row, values: action.values }))
        case 'toggleDrop':
            return mapRow(draft, action.exerciseId, action.key, (row) => ({
                ...row,
                subSets: row.subSets ? null : [{ ...EMPTY_SUB_SET }],
            }))
        case 'addSubSet':
            return mapRow(draft, action.exerciseId, action.key, (row) => ({
                ...row,
                subSets: [...(row.subSets ?? []), { ...EMPTY_SUB_SET }],
            }))
        case 'removeSubSet':
            return mapRow(draft, action.exerciseId, action.key, (row) => {
                const subSets = (row.subSets ?? []).filter((_, index) => index !== action.index)
                return { ...row, subSets: subSets.length > 0 ? subSets : null }
            })
        case 'updateSubSet':
            return mapRow(draft, action.exerciseId, action.key, (row) => ({
                ...row,
                subSets: (row.subSets ?? []).map((sub, index) =>
                    index === action.index ? { ...sub, [action.field]: action.value } : sub
                ),
            }))
    }
}

const hasValue = (values: SetFormValues): boolean => Object.values(values).some((value) => value.trim() !== '')

// Unchecked rows the user has put something into, optionally only for the
// given Exercises (the ones on screen). Finishing asks before it discards them.
export const countPendingRows = (draft: WorkoutDraft, exerciseIds?: ReadonlySet<number>): number =>
    Object.entries(draft.rows)
        .filter(([exerciseId]) => !exerciseIds || exerciseIds.has(Number(exerciseId)))
        .flatMap(([, rows]) => rows)
        .filter((row) => hasValue(row.values) || (row.subSets ?? []).some((s) => s.weight || s.reps)).length

// --- Blocks -------------------------------------------------------------------

export type ExerciseBlockModel<S> = {
    exerciseId: number
    logged: S[]
    drafts: DraftRow[]
}

// One block per Exercise, in the order Exercises were added to the draft, so
// logging a set never makes blocks jump. Exercises logged outside the draft
// (an older app version, another device) come first, in the order their first
// Set was logged.
export const buildBlocks = <S extends Pick<WorkoutSet, 'exercise_id'>>(
    loggedSets: readonly S[],
    draft: WorkoutDraft
): ExerciseBlockModel<S>[] => {
    const loggedOrder: number[] = []
    const logged = new Map<number, S[]>()
    for (const set of loggedSets) {
        if (!logged.has(set.exercise_id)) {
            logged.set(set.exercise_id, [])
            loggedOrder.push(set.exercise_id)
        }
        logged.get(set.exercise_id)?.push(set)
    }
    const order = [...loggedOrder.filter((id) => !draft.exerciseOrder.includes(id)), ...draft.exerciseOrder]
    return order.map((exerciseId) => ({
        exerciseId,
        logged: logged.get(exerciseId) ?? [],
        drafts: draft.rows[exerciseId] ?? [],
    }))
}

// --- Previous performance -----------------------------------------------------

// The Sets of the most recent finished Workout that contains each Exercise,
// in position order. Rows may come in any order.
export const pickPreviousSets = (rows: readonly HistorySet[]): Map<number, WorkoutSet[]> => {
    const latestWorkout = new Map<number, { workoutId: number; when: string }>()
    for (const row of rows) {
        const when = `${row.workout_date} ${row.workout_start}`
        const current = latestWorkout.get(row.exercise_id)
        if (!current || when > current.when || (when === current.when && row.workout_id > current.workoutId)) {
            latestWorkout.set(row.exercise_id, { workoutId: row.workout_id, when })
        }
    }
    const result = new Map<number, WorkoutSet[]>()
    for (const row of rows) {
        if (latestWorkout.get(row.exercise_id)?.workoutId !== row.workout_id) continue
        const { workout_date: _date, workout_start: _start, ...set } = row
        const list = result.get(row.exercise_id) ?? []
        list.push(set)
        result.set(row.exercise_id, list)
    }
    for (const list of result.values()) list.sort((a, b) => a.position - b.position)
    return result
}

// History rows from Workouts that took place before the given one. Editing
// an old Workout compares it with what came before it, not with later ones.
export const performedBefore = <R extends Pick<HistorySet, 'workout_date' | 'workout_start'>>(
    rows: readonly R[],
    date: string,
    start: string
): R[] => rows.filter((row) => `${row.workout_date} ${row.workout_start}` < `${date} ${start}`)

// A new row starts from the matching Set of last time (row 3 ← last time's
// set 3), then from the row above it, then empty.
export const prefillRow = (
    previous: readonly WorkoutSet[],
    rowIndex: number,
    rowAbove: SetFormValues | null
): SetFormValues => {
    const match = previous[rowIndex]
    if (match) return valuesFromSet(match)
    if (rowAbove) return rowAbove
    return EMPTY_VALUES
}

export const formatPrevious = (type: ExerciseType, set: WorkoutSet | undefined): string =>
    set ? formatCompactSetLabel(type, ExerciseTypeMetadata.defaultDominantMetric(type), set) : '—'

// --- Writing a row --------------------------------------------------------------

export const rowPayload = (type: ExerciseType, values: SetFormValues, subSets: readonly SubSetValues[] | null) =>
    buildSetPayload({ exerciseType: type, inputValues: values, subSets: subSetsFromValues(subSets ?? []) })

// --- Summary ------------------------------------------------------------------

type MetricSet = Pick<WorkoutSet, 'exercise_id' | 'weight' | 'reps' | 'sub_sets'>

// Volume counts weight × reps for `weight` Exercises only, drop stages
// included. Bodyweight is left out: body weight is not stored (owner decision).
export const workoutVolume = (sets: readonly MetricSet[], typeOf: (exerciseId: number) => ExerciseType | undefined) =>
    sets.reduce((total, set) => {
        if (typeOf(set.exercise_id) !== 'weight') return total
        const main = (set.weight ?? 0) * (set.reps ?? 0)
        const drops = parseSubSets(set.sub_sets).reduce((sum, sub) => sum + (sub.weight ?? 0) * (sub.reps ?? 0), 0)
        return total + main + drops
    }, 0)

// Exercises whose best Set in this Workout beats every earlier Set, by the
// type's default PrimaryMetric. A first-ever performance is not a record.
export const countPersonalRecords = (
    current: readonly WorkoutSet[],
    earlier: readonly WorkoutSet[],
    typeOf: (exerciseId: number) => ExerciseType | undefined
): number => {
    const byExercise = (sets: readonly WorkoutSet[]) => {
        const map = new Map<number, WorkoutSet[]>()
        for (const set of sets) map.set(set.exercise_id, [...(map.get(set.exercise_id) ?? []), set])
        return map
    }
    const earlierByExercise = byExercise(earlier)
    let records = 0
    for (const [exerciseId, sets] of byExercise(current)) {
        const type = typeOf(exerciseId)
        const before = earlierByExercise.get(exerciseId)
        if (!type || !before || before.length === 0) continue
        const metric = ExerciseTypeMetadata.defaultDominantMetric(type)
        const comparator = bestSetComparatorFor(type, metric)
        const best = (list: WorkoutSet[]) => list.reduce((acc, set) => (comparator(set, acc) < 0 ? set : acc))
        const now = best(sets)
        const then = best(before)
        if (comparator(now, then) < 0 && getSetMetricValue(now, metric) > 0) records += 1
    }
    return records
}

export const workoutDurationMinutes = (startIso: string | undefined, endIso: string | undefined): number => {
    if (!startIso || !endIso) return 0
    const minutes = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000
    return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0
}

// Elapsed time for the running header clock: m:ss under an hour, then h:mm:ss.
export const formatElapsed = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = String(totalSeconds % 60).padStart(2, '0')
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`
}
