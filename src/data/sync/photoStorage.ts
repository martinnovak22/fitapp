// IO half of exercise photo sync (issue #49): Supabase Storage REST calls and
// the local-file lifecycle around them. The decisions (key derivation, what to
// upload, what survives a pull) live in photoSync.ts. Bytes are stored in the
// private 'exercise-photos' bucket at {user_id}/{photo_key}; rows sync only the
// key, and each device keeps its own copy under documentDirectory/exercises/.

import * as FileSystem from 'expo-file-system/legacy'
import { getSupabaseConfig } from '@/src/data/remote/supabase/config'
import { getSupabaseSession, refreshSupabaseAccessToken } from '@/src/data/remote/supabase/session'
import { getDb } from '@/src/db/client'
import { nowIso } from '@/src/db/sync'
import { executeWriteTransaction } from '@/src/db/writeQueue'
import type { SyncFailureReason } from './Outbox'
import { buildPhotoKey, localPhotoPath, shouldUploadPhoto, storageObjectPath } from './photoSync'
import { isPermanentRejectionStatus } from './RemoteAdapter'

const BUCKET = 'exercise-photos'

export type ExercisePhotoStore = {
    // Uploads the row's local photo bytes to its photo_key if this device owns
    // them. Null means nothing to do or done; a reason fails the row push.
    upload(
        userId: string,
        row: { photo_key: string | null; photo_uri: string | null }
    ): Promise<SyncFailureReason | null>
    // Best-effort removal of this exercise's storage objects except keepKey
    // (null keeps nothing). Failures are swallowed — an orphan is harmless.
    cleanup(userId: string, exerciseUuid: string, keepKey: string | null): Promise<void>
}

type StorageAuth = { url: string; publicKey: string; accessToken: string }

const getStorageAuth = (): StorageAuth | null => {
    const config = getSupabaseConfig()
    const session = getSupabaseSession()
    if (!config || !session?.accessToken) return null
    return { url: config.url, publicKey: config.publicKey, accessToken: session.accessToken }
}

const authHeaders = (auth: StorageAuth, accessToken: string) => ({
    apikey: auth.publicKey,
    Authorization: `Bearer ${accessToken}`,
})

// Runs a storage call with the current access token, refreshing and retrying
// once on 401 — same recovery the PostgREST path uses for backgrounded apps.
const withAuthRetry = async <T extends { status: number }>(
    auth: StorageAuth,
    send: (accessToken: string) => Promise<T>
): Promise<T> => {
    let result = await send(auth.accessToken)
    if (result.status === 401) {
        const refreshed = await refreshSupabaseAccessToken()
        if (refreshed) result = await send(refreshed)
    }
    return result
}

const objectUrl = (auth: StorageAuth, objectPath: string, authenticated = false) =>
    `${auth.url}/storage/v1/object/${authenticated ? 'authenticated/' : ''}${BUCKET}/${objectPath}`

const uploadObject = async (objectPath: string, fileUri: string): Promise<SyncFailureReason | null> => {
    const auth = getStorageAuth()
    if (!auth) {
        return { kind: 'unknown', message: 'Photo upload requested without authenticated session.' }
    }
    let result: FileSystem.FileSystemUploadResult
    try {
        result = await withAuthRetry(auth, (token) =>
            FileSystem.uploadAsync(objectUrl(auth, objectPath), fileUri, {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
                headers: {
                    ...authHeaders(auth, token),
                    'Content-Type': 'image/jpeg',
                    'x-upsert': 'true',
                },
            })
        )
    } catch (error) {
        return { kind: 'network-error', message: error instanceof Error ? error.message : String(error) }
    }
    if (result.status >= 200 && result.status < 300) return null
    return {
        kind: isPermanentRejectionStatus(result.status) ? 'permanent-rejection' : 'network-error',
        message: `Photo upload failed (${objectPath}): ${result.status} ${result.body}`,
    }
}

// Downloads a storage object to dest; false on any failure. downloadAsync
// writes the error body to disk on non-200, so the partial file is removed.
const downloadObject = async (objectPath: string, dest: string): Promise<boolean> => {
    const auth = getStorageAuth()
    if (!auth) return false
    try {
        const result = await withAuthRetry(auth, (token) =>
            FileSystem.downloadAsync(objectUrl(auth, objectPath, true), dest, {
                headers: authHeaders(auth, token),
            })
        )
        if (result.status === 200) return true
        await FileSystem.deleteAsync(dest, { idempotent: true })
        return false
    } catch {
        await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {})
        return false
    }
}

const listObjectNames = async (auth: StorageAuth, userId: string, search: string): Promise<string[]> => {
    const result = await withAuthRetry(auth, async (token) => {
        const response = await fetch(`${auth.url}/storage/v1/object/list/${BUCKET}`, {
            method: 'POST',
            headers: { ...authHeaders(auth, token), 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefix: userId, search }),
        })
        return { status: response.status, body: await response.text() }
    })
    if (result.status !== 200) return []
    const items = JSON.parse(result.body) as { name: string }[]
    return items.map((item) => item.name)
}

const deleteObjects = async (auth: StorageAuth, objectPaths: string[]): Promise<void> => {
    if (objectPaths.length === 0) return
    await withAuthRetry(auth, async (token) => {
        const response = await fetch(`${auth.url}/storage/v1/object/${BUCKET}`, {
            method: 'DELETE',
            headers: { ...authHeaders(auth, token), 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefixes: objectPaths }),
        })
        return { status: response.status }
    })
}

const localFileExists = async (uri: string): Promise<boolean> => {
    try {
        const info = await FileSystem.getInfoAsync(uri)
        return info.exists
    } catch {
        return false
    }
}

// Removes a photo file from the app's exercises directory. Errors are
// swallowed so a failed file delete never breaks a save/delete/pull flow.
export const deleteLocalPhoto = async (uri: string | null): Promise<void> => {
    const docDir = FileSystem.documentDirectory
    if (!uri || !docDir || !uri.startsWith(`${docDir}exercises/`)) return
    try {
        await FileSystem.deleteAsync(uri, { idempotent: true })
    } catch (error) {
        console.warn('Failed to delete exercise photo:', error)
    }
}

export const createExercisePhotoStore = (): ExercisePhotoStore => ({
    async upload(userId, row) {
        if (!shouldUploadPhoto(row)) return null
        if (!(await localFileExists(row.photo_uri as string))) return null
        return uploadObject(storageObjectPath(userId, row.photo_key as string), row.photo_uri as string)
    },

    async cleanup(userId, exerciseUuid, keepKey) {
        try {
            const auth = getStorageAuth()
            if (!auth) return
            const names = await listObjectNames(auth, userId, `${exerciseUuid}-`)
            const stale = names.filter((name) => name !== keepKey)
            await deleteObjects(
                auth,
                stale.map((name) => storageObjectPath(userId, name))
            )
        } catch {
            // Best-effort: an orphaned object costs storage, never correctness.
        }
    },
})

// Per-process guards: the backfill is a one-shot normalization and the full
// hydration scan (a file-existence check per photo row, which also self-heals
// reinstalls) only needs one pass per app start. Afterwards both are skipped
// or reduced so the 60s sync polling pays nothing in steady state.
const backfilledUsers = new Set<string>()
const fullyScannedUsers = new Set<string>()
const hydrationRuns = new Map<string, Promise<number>>()

// One-time normalization of rows from before photo sync existed (and of rows
// adopted from guest mode): a photo_uri without a photo_key either gets a key
// and re-enters the outbox (this device owns the bytes), or is cleared (the
// path came from another device and the bytes were never here).
export const backfillLocalPhotoKeys = async (userId: string): Promise<void> => {
    if (backfilledUsers.has(userId) || !FileSystem.documentDirectory) return
    const db = await getDb()
    const rows = await db.getAllAsync<{ id: number; uuid: string; photo_uri: string }>(
        `SELECT id, uuid, photo_uri FROM exercises
         WHERE user_id = ? AND deleted_at IS NULL AND photo_uri IS NOT NULL AND photo_key IS NULL`,
        userId
    )
    if (rows.length > 0) {
        const fileExists = await Promise.all(rows.map((row) => localFileExists(row.photo_uri)))
        await executeWriteTransaction(async (writeDb) => {
            for (let i = 0; i < rows.length; i += 1) {
                if (fileExists[i]) {
                    await writeDb.runAsync(
                        `UPDATE exercises SET photo_key = ?, sync_status = 'dirty', updated_at = ? WHERE id = ?`,
                        buildPhotoKey(rows[i].uuid, rows[i].photo_uri),
                        nowIso(),
                        rows[i].id
                    )
                } else {
                    await writeDb.runAsync(`UPDATE exercises SET photo_uri = NULL WHERE id = ?`, rows[i].id)
                }
            }
        })
    }
    backfilledUsers.add(userId)
}

// Fire-and-forget after a pull: downloads bytes for rows whose photo_key has
// no local file yet (fresh pull, key change, reinstall). Never marks rows
// dirty — photo_uri is device-local state. Returns how many photos landed so
// the caller can invalidate read caches. Single-flighted per user: a cycle
// that fires while that user's previous hydration still runs joins it instead
// of racing it, and a principal change never joins another user's run.
export const hydrateExercisePhotos = async (userId: string): Promise<number> => {
    const existing = hydrationRuns.get(userId)
    if (existing) return existing
    const run = (async () => {
        const docDir = FileSystem.documentDirectory
        if (!docDir) return 0
        const db = await getDb()
        // The pull clears photo_uri whenever a key arrives or changes, so the
        // steady-state query matches nothing; the first pass of a session also
        // re-checks rows with a photo_uri to repair missing files.
        const fullScan = !fullyScannedUsers.has(userId)
        const rows = await db.getAllAsync<{ id: number; photo_key: string; photo_uri: string | null }>(
            `SELECT id, photo_key, photo_uri FROM exercises
             WHERE user_id = ? AND deleted_at IS NULL AND photo_key IS NOT NULL
             ${fullScan ? '' : 'AND photo_uri IS NULL'}`,
            userId
        )

        let hydrated = 0
        if (rows.length > 0) {
            await FileSystem.makeDirectoryAsync(`${docDir}exercises/`, { intermediates: true }).catch(() => {})
        }
        for (const row of rows) {
            if (row.photo_uri && (await localFileExists(row.photo_uri))) continue

            const dest = localPhotoPath(docDir, row.photo_key)
            if (!(await downloadObject(storageObjectPath(userId, row.photo_key), dest))) continue

            await executeWriteTransaction((writeDb) =>
                writeDb.runAsync(`UPDATE exercises SET photo_uri = ? WHERE id = ?`, dest, row.id)
            )
            hydrated += 1
        }
        fullyScannedUsers.add(userId)
        return hydrated
    })()
    hydrationRuns.set(userId, run)
    try {
        return await run
    } finally {
        hydrationRuns.delete(userId)
    }
}
