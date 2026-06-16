import { describe, expect, it } from 'vitest'
import { buildSetMetricColumns, MAX_SUB_SETS_LENGTH, resolveNextSetPosition } from '../setWriteValues'

describe('resolveNextSetPosition', () => {
    it('starts at 0 when there is no prior set', () => {
        expect(resolveNextSetPosition(null)).toBe(0)
        expect(resolveNextSetPosition(undefined)).toBe(0)
    })

    it('appends after the last set position', () => {
        expect(resolveNextSetPosition({ position: 0 })).toBe(1)
        expect(resolveNextSetPosition({ position: 7 })).toBe(8)
    })
})

describe('buildSetMetricColumns', () => {
    it('coalesces every missing metric to null', () => {
        expect(buildSetMetricColumns({})).toEqual({
            weight: null,
            reps: null,
            distance: null,
            duration: null,
            sub_sets: null,
        })
    })

    it('passes through populated metrics verbatim', () => {
        expect(buildSetMetricColumns({ weight: 100, reps: 5, distance: 1000, duration: 300, sub_sets: '[]' })).toEqual({
            weight: 100,
            reps: 5,
            distance: 1000,
            duration: 300,
            sub_sets: '[]',
        })
    })

    it('keeps an explicit zero rather than coalescing it to null', () => {
        expect(buildSetMetricColumns({ weight: 0, reps: 0 })).toMatchObject({
            weight: 0,
            reps: 0,
            distance: null,
            duration: null,
        })
    })

    it('rejects sub_sets JSON over the sanity cap so it never reaches the push pipeline', () => {
        const atCap = `${'['.padEnd(MAX_SUB_SETS_LENGTH - 1, ' ')}]`
        expect(buildSetMetricColumns({ sub_sets: atCap }).sub_sets).toBe(atCap)

        const overCap = `${'['.padEnd(MAX_SUB_SETS_LENGTH, ' ')}]`
        expect(() => buildSetMetricColumns({ sub_sets: overCap })).toThrow(/sub_sets JSON exceeds/)
    })
})
