import { describe, expect, it } from 'vitest'
import {
    normalizeExerciseUuids,
    parseExerciseUuids,
    repointExerciseUuids,
    resolveMembers,
    serializeExerciseUuids,
} from '../templateMembership'

describe('templateMembership', () => {
    it('normalizes to trimmed, unique, non-empty uuids in first-seen order', () => {
        expect(normalizeExerciseUuids([' a ', 'b', 'a', '', 3, null, 'c'])).toEqual(['a', 'b', 'c'])
    })

    it('parses the local JSON text column and the remote jsonb array alike', () => {
        expect(parseExerciseUuids('["a","b"]')).toEqual(['a', 'b'])
        expect(parseExerciseUuids(['a', 'b'])).toEqual(['a', 'b'])
    })

    it('reads junk as an empty Template instead of throwing', () => {
        expect(parseExerciseUuids(null)).toEqual([])
        expect(parseExerciseUuids('')).toEqual([])
        expect(parseExerciseUuids('not json')).toEqual([])
        expect(parseExerciseUuids('{"a":1}')).toEqual([])
    })

    it('serializes canonically', () => {
        expect(serializeExerciseUuids(['b', 'a', 'b'])).toBe('["b","a"]')
    })

    it('resolves members in Exercise-list order, skipping uuids that are not live here', () => {
        const exercises = [{ uuid: 'a' }, { uuid: 'b' }, { uuid: null }, { uuid: 'c' }]
        expect(resolveMembers(['c', 'gone', 'a'], exercises)).toEqual([{ uuid: 'a' }, { uuid: 'c' }])
    })

    it('re-points merged uuids onto the survivor and collapses the repeat', () => {
        expect(repointExerciseUuids('["dup","x","keep"]', new Set(['dup']), 'keep')).toBe('["keep","x"]')
    })

    it('reports no change when no merged uuid is a member', () => {
        expect(repointExerciseUuids('["x"]', new Set(['dup']), 'keep')).toBeNull()
    })
})
