import { describe, expect, it } from 'vitest'
import type { Exercise } from '@/src/db/exercises'
import type { DuplicateGroup } from '../exerciseDedup'
import { initReviewItems, isReviewComplete, mergeInputFor, resolveItem, setSurvivor } from '../reviewState'

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

const group = (survivor: Exercise, ...duplicates: Exercise[]): DuplicateGroup => ({
    normalizedName: 'bench press',
    members: [survivor, ...duplicates],
    survivor,
    duplicates,
})

describe('reviewState', () => {
    it('initializes each group as pending with the pre-selected survivor', () => {
        const s = ex()
        const d = ex()
        const items = initReviewItems([group(s, d)])
        expect(items).toHaveLength(1)
        expect(items[0].survivorId).toBe(s.id)
        expect(items[0].status).toBe('pending')
    })

    it('derives the merge input as the chosen survivor plus every other member', () => {
        const s = ex()
        const d1 = ex()
        const d2 = ex()
        const [item] = initReviewItems([group(s, d1, d2)])
        expect(mergeInputFor(item)).toEqual({ survivorId: s.id, duplicateIds: [d1.id, d2.id] })
    })

    it('lets the user override the survivor, which reshapes the merge input', () => {
        const s = ex()
        const d = ex()
        let [item] = initReviewItems([group(s, d)])
        const items = setSurvivor([item], 0, d.id)
        item = items[0]
        expect(item.survivorId).toBe(d.id)
        expect(mergeInputFor(item)).toEqual({ survivorId: d.id, duplicateIds: [s.id] })
    })

    it('is complete only once no group is left pending', () => {
        const items = initReviewItems([group(ex(), ex()), group(ex(), ex())])
        expect(isReviewComplete(items)).toBe(false)
        const afterOne = resolveItem(items, 0, 'merged')
        expect(isReviewComplete(afterOne)).toBe(false)
        const afterBoth = resolveItem(afterOne, 1, 'skipped')
        expect(isReviewComplete(afterBoth)).toBe(true)
    })
})
