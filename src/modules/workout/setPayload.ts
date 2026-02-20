import type { ExerciseType } from '@/src/db/exercises'
import type { SetData, SubSet } from '@/src/db/workouts'

export type SetFormValues = {
    weight: string
    reps: string
    distance: string
    durationMinutes: string
    durationSeconds: string
}

type BuildSetPayloadInput = {
    exerciseType: ExerciseType
    inputValues: SetFormValues
    subSets: SubSet[]
}

type BuildSetPayloadResult = {
    data: SetData
    hasMainData: boolean
    hasSubSets: boolean
    hasAnyData: boolean
}

const parseOptionalNumber = (value: string): number | undefined => {
    if (!value) return undefined
    const parsed = parseFloat(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : undefined
}

const parseOptionalInt = (value: string): number | undefined => {
    if (!value) return undefined
    const parsed = parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : undefined
}

const isPositiveNumber = (value: number | undefined): boolean => {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function buildSetPayload({ exerciseType, inputValues, subSets }: BuildSetPayloadInput): BuildSetPayloadResult {
    const { weight, reps, distance, durationMinutes, durationSeconds } = inputValues
    const normalizedType = exerciseType.toLowerCase() as ExerciseType
    const needsDuration = normalizedType === 'cardio' || normalizedType === 'bodyweight_timer'

    let duration: number | undefined
    if (needsDuration) {
        const parsedMinutes = parseOptionalNumber(durationMinutes)
        const parsedSeconds = parseOptionalNumber(durationSeconds)
        if (parsedMinutes !== undefined || parsedSeconds !== undefined) {
            duration = (parsedMinutes ?? 0) + (parsedSeconds ?? 0) / 60
        }
    }

    const data: SetData = {}
    if (normalizedType !== 'cardio') {
        data.weight = parseOptionalNumber(weight)
    }
    if (normalizedType === 'weight' || normalizedType === 'bodyweight') {
        data.reps = parseOptionalInt(reps)
    }
    if (normalizedType === 'cardio') {
        data.distance = parseOptionalNumber(distance)
    }
    if (needsDuration) {
        data.duration = duration
    }

    const filteredSubSets = subSets.filter((subSet) => isPositiveNumber(subSet.weight) || isPositiveNumber(subSet.reps))
    data.sub_sets = filteredSubSets.length > 0 ? JSON.stringify(filteredSubSets) : undefined

    const hasMainData =
        isPositiveNumber(data.weight) ||
        isPositiveNumber(data.reps) ||
        isPositiveNumber(data.distance) ||
        isPositiveNumber(data.duration)

    const hasSubSets = filteredSubSets.length > 0

    return {
        data,
        hasMainData,
        hasSubSets,
        hasAnyData: hasMainData || hasSubSets,
    }
}
