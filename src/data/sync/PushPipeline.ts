// Wires Outbox rows to the RemoteWriter / RemoteIdResolver. The cycle driver
// in SyncCycle.ts calls these directly; runSync in syncService.ts composes
// them with the rest of a sync run (sync_state updates, pulls, etc.).

import { type ExerciseRow, type OutboxRow, type SetRowWithRefs, tableOf, type WorkoutRow } from './Outbox'
import type { PrincipalSnapshot } from './PrincipalSnapshot'
import type { ExercisePhotoStore } from './photoStorage'
import { shouldUploadPhoto } from './photoSync'
import type { RemoteRow, RemoteTable } from './RemoteAdapter'
import type { RemoteIdResolver } from './RemoteIdResolver'
import type { RemoteWriteResult, RemoteWriter } from './RemoteWriter'
import type { PushFn, PushOutcome } from './SyncCycle'

const nowIso = () => new Date().toISOString()
const toIsoOrNow = (value?: string | null) => value ?? nowIso()

const exerciseToRemote = (snapshot: PrincipalSnapshot, row: ExerciseRow): RemoteRow => ({
    uuid: row.uuid,
    user_id: snapshot.userId,
    name: row.name,
    type: row.type,
    muscle_group: row.muscle_group,
    // photo_uri is a device-local file path and never syncs; the photo bytes
    // travel via the storage bucket under photo_key (issue #49).
    photo_key: row.photo_key,
    position: row.position,
    created_at: toIsoOrNow(row.created_at),
    updated_at: toIsoOrNow(row.updated_at),
    deleted_at: row.deleted_at,
    sync_status: 'dirty',
})

const workoutToRemote = (snapshot: PrincipalSnapshot, row: WorkoutRow): RemoteRow => ({
    uuid: row.uuid,
    user_id: snapshot.userId,
    date: row.date,
    start_time: row.start_time,
    end_time: row.end_time,
    status: row.status,
    note: row.note,
    created_at: toIsoOrNow(row.created_at),
    updated_at: toIsoOrNow(row.updated_at),
    deleted_at: row.deleted_at,
    sync_status: 'dirty',
})

const setToRemote = (
    snapshot: PrincipalSnapshot,
    row: SetRowWithRefs,
    workoutId: number,
    exerciseId: number
): RemoteRow => ({
    uuid: row.uuid,
    user_id: snapshot.userId,
    workout_id: workoutId,
    exercise_id: exerciseId,
    weight: row.weight,
    reps: row.reps,
    distance: row.distance,
    duration: row.duration,
    rpe: row.rpe,
    position: row.position,
    sub_sets: row.sub_sets,
    created_at: toIsoOrNow(row.created_at),
    updated_at: toIsoOrNow(row.updated_at),
    deleted_at: row.deleted_at,
    sync_status: 'dirty',
})

const outcomeFromWrite = (result: RemoteWriteResult): PushOutcome =>
    result.kind === 'persisted' ? { kind: 'ack' } : { kind: 'fail', reason: result.reason }

export const preloadSetParents = async (resolver: RemoteIdResolver, batch: OutboxRow[]): Promise<void> => {
    const workoutUuids: string[] = []
    const exerciseUuids: string[] = []
    for (const row of batch) {
        if (row.kind === 'entity' && row.entityType === 'set') {
            workoutUuids.push(row.row.workout_uuid)
            exerciseUuids.push(row.row.exercise_uuid)
        }
    }
    if (workoutUuids.length > 0) await resolver.resolveMany('workouts', workoutUuids)
    if (exerciseUuids.length > 0) await resolver.resolveMany('exercises', exerciseUuids)
}

export const makePushFn =
    (
        snapshot: PrincipalSnapshot,
        writer: RemoteWriter,
        resolver: RemoteIdResolver,
        photos: ExercisePhotoStore
    ): PushFn =>
    async (row) => {
        if (row.kind === 'tombstone') {
            if (!snapshot.userId) {
                return {
                    kind: 'fail',
                    reason: { kind: 'unknown', message: 'Cannot push tombstone without account principal.' },
                }
            }
            const result = await writer.patch(tableOf(row.entityType) as RemoteTable, row.uuid, snapshot.userId, {
                deleted_at: row.deletedAt,
                updated_at: row.deletedAt,
                sync_status: 'dirty',
            })
            if (result.kind === 'persisted' && row.entityType === 'exercise') {
                void photos.cleanup(snapshot.userId, row.uuid, null)
            }
            return outcomeFromWrite(result)
        }

        if (row.entityType === 'exercise') {
            // The bytes must be in the bucket before the row referencing them
            // lands remotely; a failed upload fails the row push so the outbox
            // retry machinery covers both.
            const ownsPhotoBytes = !!snapshot.userId && shouldUploadPhoto(row.row)
            if (ownsPhotoBytes) {
                const uploadFailure = await photos.upload(snapshot.userId as string, row.row)
                if (uploadFailure) return { kind: 'fail', reason: uploadFailure }
            }
            const [result] = await writer.upsert('exercises', [exerciseToRemote(snapshot, row.row)])
            if (result.kind === 'persisted') {
                resolver.record('exercises', [{ uuid: result.uuid, id: result.id }])
                // Only a fresh upload can supersede an older object, so
                // metadata-only pushes skip the storage list round trip. A
                // removed photo's object lingers until the exercise tombstone.
                if (ownsPhotoBytes) {
                    void photos.cleanup(snapshot.userId as string, row.uuid, row.row.photo_key)
                }
            }
            return outcomeFromWrite(result)
        }
        if (row.entityType === 'workout') {
            const [result] = await writer.upsert('workouts', [workoutToRemote(snapshot, row.row)])
            if (result.kind === 'persisted') {
                resolver.record('workouts', [{ uuid: result.uuid, id: result.id }])
            }
            return outcomeFromWrite(result)
        }

        // set: resolver was pre-populated for the batch by preloadSetParents.
        const workoutIds = await resolver.resolveMany('workouts', [row.row.workout_uuid])
        const exerciseIds = await resolver.resolveMany('exercises', [row.row.exercise_uuid])
        const workoutId = workoutIds.get(row.row.workout_uuid)
        const exerciseId = exerciseIds.get(row.row.exercise_uuid)
        if (!workoutId || !exerciseId) {
            return {
                kind: 'fail',
                reason: {
                    kind: 'missing-parent',
                    message: `set ${row.uuid} missing remote parent (workout=${!!workoutId} exercise=${!!exerciseId})`,
                },
            }
        }
        const [result] = await writer.upsert('sets', [setToRemote(snapshot, row.row, workoutId, exerciseId)])
        return outcomeFromWrite(result)
    }
