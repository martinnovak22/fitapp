// Pure decisions for exercise photo sync (issue #49). exercises.photo_uri is a
// device-local file path and never syncs; exercises.photo_key is the synced
// storage key. Bytes live in the private 'exercise-photos' bucket at
// {user_id}/{photo_key}. IO lives in photoStorage.ts; this module is
// dependency-free so it runs under the node test environment.

const basename = (uri: string): string => uri.split('/').pop() ?? uri

// The key embeds the local file's timestamp basename, so replacing a photo
// (new local file) yields a new key and other devices detect the change.
export const buildPhotoKey = (uuid: string, photoUri: string | null): string | null =>
    photoUri ? `${uuid}-${basename(photoUri)}` : null

// Key for an exercise update: regenerate only when the photo actually changed,
// so metadata edits don't churn the key (and force re-downloads elsewhere).
export const nextPhotoKey = (
    currentKey: string | null,
    currentUri: string | null,
    uuid: string,
    nextUri: string | null
): string | null => (nextUri === currentUri ? currentKey : buildPhotoKey(uuid, nextUri))

export const storageObjectPath = (userId: string, photoKey: string): string => `${userId}/${photoKey}`

// Hydrated downloads are named by the key, unlike locally-captured files
// (timestamp basename) — shouldUploadPhoto relies on that distinction.
export const localPhotoPath = (docDir: string, photoKey: string): string => `${docDir}exercises/${photoKey}`

export type PulledPhotoUri = {
    photoUri: string | null
    staleUri: string | null
}

// Pull-side: the local photo file survives only while the pulled key still
// matches the local key. A changed or cleared key invalidates it; the caller
// deletes staleUri after the row write commits and hydration re-downloads.
export const resolvePulledPhotoUri = (
    localKey: string | null,
    localUri: string | null,
    remoteKey: string | null
): PulledPhotoUri => {
    if (!localUri) return { photoUri: null, staleUri: null }
    if (remoteKey && remoteKey === localKey) return { photoUri: localUri, staleUri: null }
    return { photoUri: null, staleUri: localUri }
}

// Push-side: upload only when the local bytes originated on this device. A
// hydrated copy is named by the key itself — its bytes came from the bucket,
// so re-uploading them is pure waste.
export const shouldUploadPhoto = (row: { photo_key: string | null; photo_uri: string | null }): boolean =>
    !!row.photo_key && !!row.photo_uri && basename(row.photo_uri) !== row.photo_key
