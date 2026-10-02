import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb, getTestDb, resetTestDb, type TestDb, useTestDb } from '@/src/test/setupTestDb'

vi.mock('@/src/db/client', () => ({
    getDb: async () => getTestDb(),
}))

const { WorkoutTemplateRepository } = await import('../workoutTemplates')
const { WorkoutRepository } = await import('../workouts')
const { setActivePrincipal } = await import('@/src/data/principal')

let db: TestDb

beforeEach(async () => {
    await resetTestDb()
    db = await createTestDb()
    useTestDb(db)
    setActivePrincipal({ mode: 'account', userId: 'user-A' })
})

const rawRow = (id: number) =>
    db.getFirstAsync<{ user_id: string | null; exercise_uuids: string; sync_status: string; position: number }>(
        'SELECT user_id, exercise_uuids, sync_status, position FROM workout_templates WHERE id = ?',
        id
    )

describe('WorkoutTemplateRepository', () => {
    it('creates a dirty, principal-owned Template with canonical membership', async () => {
        const id = await WorkoutTemplateRepository.create({ name: '  Push A ', exerciseUuids: ['b', 'a', 'b'] })

        const template = await WorkoutTemplateRepository.getById(id)
        expect(template?.name).toBe('Push A')
        expect(template?.exercise_uuids).toEqual(['b', 'a'])
        expect(await rawRow(id)).toMatchObject({ user_id: 'user-A', sync_status: 'dirty', exercise_uuids: '["b","a"]' })
    })

    it('appends new Templates after the active principal’s last position only', async () => {
        await db.runAsync(
            `INSERT INTO workout_templates (uuid, user_id, name, position) VALUES ('t-foreign', 'user-B', 'X', 9)`
        )
        const first = await WorkoutTemplateRepository.create({ name: 'A', exerciseUuids: [] })
        const second = await WorkoutTemplateRepository.create({ name: 'B', exerciseUuids: [] })

        expect((await rawRow(first))?.position).toBe(0)
        expect((await rawRow(second))?.position).toBe(1)
    })

    it('lists only the active principal’s Templates, ordered by position then name', async () => {
        await WorkoutTemplateRepository.create({ name: 'Legs', exerciseUuids: [] })
        await WorkoutTemplateRepository.create({ name: 'Arms', exerciseUuids: [] })
        await db.runAsync(`INSERT INTO workout_templates (uuid, user_id, name) VALUES ('t-guest', NULL, 'Guest')`)

        const all = await WorkoutTemplateRepository.getAll()
        expect(all.map((t) => t.name)).toEqual(['Legs', 'Arms'])
    })

    it('updates name and membership independently and re-dirties the row', async () => {
        const id = await WorkoutTemplateRepository.create({ name: 'Push', exerciseUuids: ['a'] })
        await db.runAsync(`UPDATE workout_templates SET sync_status = 'synced' WHERE id = ?`, id)

        await WorkoutTemplateRepository.update(id, { exerciseUuids: ['a', 'c'] })

        const template = await WorkoutTemplateRepository.getById(id)
        expect(template?.name).toBe('Push')
        expect(template?.exercise_uuids).toEqual(['a', 'c'])
        expect((await rawRow(id))?.sync_status).toBe('dirty')
    })

    it('cannot touch another principal’s Template', async () => {
        const result = await db.runAsync(
            `INSERT INTO workout_templates (uuid, user_id, name) VALUES ('t-foreign', 'user-B', 'Theirs')`
        )
        const foreignId = result.lastInsertRowId

        await WorkoutTemplateRepository.update(foreignId, { name: 'Mine now' })
        await WorkoutTemplateRepository.delete(foreignId)

        expect(await WorkoutTemplateRepository.getById(foreignId)).toBeNull()
        const raw = await db.getFirstAsync<{ name: string }>(
            'SELECT name FROM workout_templates WHERE id = ?',
            foreignId
        )
        expect(raw?.name).toBe('Theirs')
    })

    it('deletes via a tombstone and leaves Workouts started from it intact', async () => {
        const id = await WorkoutTemplateRepository.create({ name: 'Push', exerciseUuids: [] })
        const template = await WorkoutTemplateRepository.getById(id)
        const workoutId = await WorkoutRepository.create('2026-10-02', template?.uuid)

        await WorkoutTemplateRepository.delete(id)

        expect(await WorkoutTemplateRepository.getById(id)).toBeNull()
        const tombstone = await db.getFirstAsync<{ entity_type: string; entity_uuid: string }>(
            'SELECT entity_type, entity_uuid FROM deletion_tombstones'
        )
        expect(tombstone).toEqual({ entity_type: 'workout_template', entity_uuid: template?.uuid })
        const workout = await WorkoutRepository.getById(workoutId)
        expect(workout?.template_uuid).toBe(template?.uuid)
    })

    it('resolves a Template by uuid', async () => {
        const id = await WorkoutTemplateRepository.create({ name: 'Push', exerciseUuids: [] })
        const created = await WorkoutTemplateRepository.getById(id)

        expect((await WorkoutTemplateRepository.getByUuid(created?.uuid ?? ''))?.id).toBe(id)
        expect(await WorkoutTemplateRepository.getByUuid('missing')).toBeNull()
    })
})

describe('WorkoutRepository.create', () => {
    it('starts an Unplanned Workout by default', async () => {
        const id = await WorkoutRepository.create('2026-10-02')
        expect((await WorkoutRepository.getById(id))?.template_uuid).toBeNull()
    })
})
