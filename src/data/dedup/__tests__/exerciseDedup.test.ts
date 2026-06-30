import { describe, expect, it } from 'vitest'
import type { Exercise } from '@/src/db/exercises'
import { findDuplicateExerciseGroups, normalizeExerciseName } from '../exerciseDedup'

let nextId = 1
const ex = (overrides: Partial<Exercise> = {}): Exercise => ({
    id: nextId++,
    uuid: `uuid-${nextId}`,
    name: 'Bench Press',
    type: 'weight',
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    sync_status: 'synced',
    deleted_at: null,
    ...overrides,
})

const noSets: ReadonlyMap<number, number> = new Map()

describe('normalizeExerciseName', () => {
    it('trims, collapses internal whitespace, and lowercases', () => {
        expect(normalizeExerciseName('  Bench   Press ')).toBe('bench press')
    })

    it('folds Czech diacritics so accented and unaccented names match', () => {
        expect(normalizeExerciseName('Dřep')).toBe('drep')
        expect(normalizeExerciseName('Bicepsový zdvih')).toBe(normalizeExerciseName('bicepsovy zdvih'))
    })
})

describe('findDuplicateExerciseGroups', () => {
    it('returns no groups when every name is distinct', () => {
        const exercises = [ex({ name: 'Bench Press' }), ex({ name: 'Squat' }), ex({ name: 'Deadlift' })]
        expect(findDuplicateExerciseGroups(exercises, noSets)).toEqual([])
    })

    it('groups two rows that share a name into one group with both members', () => {
        const a = ex({ name: 'Bench Press' })
        const b = ex({ name: 'Bench Press' })
        const groups = findDuplicateExerciseGroups([a, b], noSets)
        expect(groups).toHaveLength(1)
        expect(groups[0].members).toHaveLength(2)
        expect(groups[0].members).toEqual(expect.arrayContaining([a, b]))
    })

    it('groups case, whitespace, and diacritic variants of the same name together', () => {
        const a = ex({ name: 'Bench Press' })
        const b = ex({ name: '  bench   press ' })
        const c = ex({ name: 'BENCH PRESS' })
        const groups = findDuplicateExerciseGroups([a, b, c], noSets)
        expect(groups).toHaveLength(1)
        expect(groups[0].members).toHaveLength(3)
    })

    it('ignores soft-deleted rows so a deleted duplicate does not resurface', () => {
        const live = ex({ name: 'Bench Press' })
        const deleted = ex({ name: 'Bench Press', deleted_at: '2026-02-01T00:00:00Z' })
        expect(findDuplicateExerciseGroups([live, deleted], noSets)).toEqual([])
    })

    it('keeps distinct names in separate groups and excludes singletons', () => {
        const benchA = ex({ name: 'Bench Press' })
        const benchB = ex({ name: 'Bench Press' })
        const squat = ex({ name: 'Squat' })
        const groups = findDuplicateExerciseGroups([benchA, benchB, squat], noSets)
        expect(groups).toHaveLength(1)
        expect(groups[0].normalizedName).toBe('bench press')
    })

    describe('survivor selection', () => {
        it('picks the oldest created_at as the survivor regardless of input order', () => {
            const newer = ex({ created_at: '2026-03-01T00:00:00Z' })
            const oldest = ex({ created_at: '2026-01-01T00:00:00Z' })
            const middle = ex({ created_at: '2026-02-01T00:00:00Z' })
            const [group] = findDuplicateExerciseGroups([newer, oldest, middle], noSets)
            expect(group.survivor).toBe(oldest)
            expect(group.duplicates).toEqual(expect.arrayContaining([newer, middle]))
            expect(group.duplicates).toHaveLength(2)
        })

        it('breaks a created_at tie by the most referencing Sets', () => {
            const fewer = ex({ created_at: '2026-01-01T00:00:00Z' })
            const more = ex({ created_at: '2026-01-01T00:00:00Z' })
            const setCounts = new Map([
                [fewer.id, 2],
                [more.id, 9],
            ])
            const [group] = findDuplicateExerciseGroups([fewer, more], setCounts)
            expect(group.survivor).toBe(more)
        })

        it('breaks a remaining tie by preferring a synced row over an unsynced one', () => {
            const dirty = ex({ sync_status: 'dirty' })
            const synced = ex({ sync_status: 'synced' })
            const [group] = findDuplicateExerciseGroups([dirty, synced], noSets)
            expect(group.survivor).toBe(synced)
        })

        it('falls back to the lowest uuid for full determinism', () => {
            const higher = ex({ uuid: 'uuid-zzz' })
            const lower = ex({ uuid: 'uuid-aaa' })
            const [group] = findDuplicateExerciseGroups([higher, lower], noSets)
            expect(group.survivor).toBe(lower)
        })
    })
})
