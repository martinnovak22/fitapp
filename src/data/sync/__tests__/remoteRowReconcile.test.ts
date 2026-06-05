import { describe, expect, it } from 'vitest'
import { shouldSkipRemoteRow, toExerciseColumns, toSetColumns, toWorkoutColumns } from '../remoteRowReconcile'

describe('shouldSkipRemoteRow — last-writer-wins conflict guard', () => {
    it('never skips when there is no local row', () => {
        expect(shouldSkipRemoteRow(null, '2026-01-01T00:00:00Z')).toBe(false)
        expect(shouldSkipRemoteRow(undefined, '2026-01-01T00:00:00Z')).toBe(false)
    })

    it('does not skip a clean (synced) local row even if it is newer', () => {
        const local = { updated_at: '2026-02-01T00:00:00Z', sync_status: 'synced' }
        expect(shouldSkipRemoteRow(local, '2026-01-01T00:00:00Z')).toBe(false)
    })

    it('skips when the local row is dirty and strictly newer than the remote row', () => {
        const local = { updated_at: '2026-02-01T00:00:00Z', sync_status: 'dirty' }
        expect(shouldSkipRemoteRow(local, '2026-01-01T00:00:00Z')).toBe(true)
    })

    it('skips when the local row is failed and strictly newer than the remote row', () => {
        const local = { updated_at: '2026-02-01T00:00:00Z', sync_status: 'failed' }
        expect(shouldSkipRemoteRow(local, '2026-01-01T00:00:00Z')).toBe(true)
    })

    it('does not skip a dirty local row that is older than or equal to the remote row', () => {
        const local = { updated_at: '2026-01-01T00:00:00Z', sync_status: 'dirty' }
        expect(shouldSkipRemoteRow(local, '2026-02-01T00:00:00Z')).toBe(false)
        expect(shouldSkipRemoteRow(local, '2026-01-01T00:00:00Z')).toBe(false)
    })

    it('treats an unparseable or missing remote timestamp as epoch zero', () => {
        const local = { updated_at: '2026-01-01T00:00:00Z', sync_status: 'dirty' }
        expect(shouldSkipRemoteRow(local, null)).toBe(true)
        expect(shouldSkipRemoteRow(local, undefined)).toBe(true)
    })
})

describe('toExerciseColumns — remote exercise row → local column values', () => {
    it('coalesces optional fields and falls back to defaults', () => {
        const cols = toExerciseColumns({ created_at: null, updated_at: null }, 'user-1')
        expect(cols).toMatchObject({
            user_id: 'user-1',
            name: null,
            type: 'weight',
            muscle_group: null,
            photo_uri: null,
            position: 0,
        })
        // null created/updated coalesce to a real ISO timestamp.
        expect(typeof cols.created_at).toBe('string')
        expect(typeof cols.updated_at).toBe('string')
    })

    it('passes through populated fields verbatim', () => {
        const cols = toExerciseColumns(
            {
                name: 'Bench',
                type: 'bodyweight',
                muscle_group: 'chest',
                photo_uri: 'file://x.png',
                position: 4,
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-02-01T00:00:00Z',
            },
            'user-1'
        )
        expect(cols).toEqual({
            user_id: 'user-1',
            name: 'Bench',
            type: 'bodyweight',
            muscle_group: 'chest',
            photo_uri: 'file://x.png',
            position: 4,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-02-01T00:00:00Z',
        })
    })
})

describe('toWorkoutColumns — remote workout row → local column values', () => {
    it('coalesces optional fields and defaults status to finished', () => {
        const cols = toWorkoutColumns({ created_at: null, updated_at: null }, 'user-1')
        expect(cols).toMatchObject({
            user_id: 'user-1',
            date: null,
            start_time: null,
            end_time: null,
            status: 'finished',
            note: null,
        })
        expect(typeof cols.created_at).toBe('string')
        expect(typeof cols.updated_at).toBe('string')
    })

    it('passes through populated fields verbatim', () => {
        const cols = toWorkoutColumns(
            {
                date: '2026-03-01',
                start_time: '08:00',
                end_time: '09:00',
                status: 'in_progress',
                note: 'leg day',
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-02-01T00:00:00Z',
            },
            'user-1'
        )
        expect(cols).toEqual({
            user_id: 'user-1',
            date: '2026-03-01',
            start_time: '08:00',
            end_time: '09:00',
            status: 'in_progress',
            note: 'leg day',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-02-01T00:00:00Z',
        })
    })
})

describe('toSetColumns — remote set row → local column values', () => {
    it('passes metric fields through raw and injects resolved parent ids', () => {
        const cols = toSetColumns(
            {
                weight: 100,
                reps: 5,
                distance: null,
                duration: null,
                rpe: 8,
                position: 2,
                sub_sets: null,
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-02-01T00:00:00Z',
            },
            'user-1',
            11,
            22
        )
        expect(cols).toEqual({
            user_id: 'user-1',
            workout_id: 11,
            exercise_id: 22,
            weight: 100,
            reps: 5,
            distance: null,
            duration: null,
            rpe: 8,
            position: 2,
            sub_sets: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-02-01T00:00:00Z',
        })
    })

    it('coalesces null timestamps to a real ISO string', () => {
        const cols = toSetColumns(
            {
                weight: null,
                reps: null,
                distance: 1000,
                duration: 300,
                rpe: null,
                position: 0,
                sub_sets: '[]',
                created_at: null,
                updated_at: null,
            },
            'user-1',
            1,
            2
        )
        expect(typeof cols.created_at).toBe('string')
        expect(typeof cols.updated_at).toBe('string')
        // raw metric pass-through preserved even when null.
        expect(cols.weight).toBeNull()
        expect(cols.distance).toBe(1000)
        expect(cols.sub_sets).toBe('[]')
    })
})
