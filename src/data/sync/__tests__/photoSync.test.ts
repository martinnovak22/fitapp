import { describe, expect, it } from 'vitest'
import {
    buildPhotoKey,
    localPhotoPath,
    nextPhotoKey,
    resolvePulledPhotoUri,
    shouldUploadPhoto,
    storageObjectPath,
} from '../photoSync'

const docDir = 'file:///doc/'
const uuid = 'ab12'

describe('buildPhotoKey', () => {
    it('derives the key from the exercise uuid and the local file basename', () => {
        expect(buildPhotoKey(uuid, 'file:///doc/exercises/1718097829000.jpg')).toBe('ab12-1718097829000.jpg')
    })

    it('is null without a photo uri', () => {
        expect(buildPhotoKey(uuid, null)).toBeNull()
        expect(buildPhotoKey(uuid, '')).toBeNull()
    })
})

describe('nextPhotoKey', () => {
    it('keeps the current key when the photo uri is unchanged', () => {
        expect(nextPhotoKey('ab12-1.jpg', 'file:///doc/exercises/1.jpg', uuid, 'file:///doc/exercises/1.jpg')).toBe(
            'ab12-1.jpg'
        )
    })

    it('derives a fresh key when the photo was replaced', () => {
        expect(nextPhotoKey('ab12-1.jpg', 'file:///doc/exercises/1.jpg', uuid, 'file:///doc/exercises/2.jpg')).toBe(
            'ab12-2.jpg'
        )
    })

    it('clears the key when the photo was removed', () => {
        expect(nextPhotoKey('ab12-1.jpg', 'file:///doc/exercises/1.jpg', uuid, null)).toBeNull()
    })

    it('derives a key when a photo is attached to a row that had none', () => {
        expect(nextPhotoKey(null, null, uuid, 'file:///doc/exercises/2.jpg')).toBe('ab12-2.jpg')
    })
})

describe('paths', () => {
    it('maps a key to the per-user storage object path', () => {
        expect(storageObjectPath('user-1', 'ab12-1.jpg')).toBe('user-1/ab12-1.jpg')
    })

    it('maps a key to the local exercises directory, named by the key', () => {
        expect(localPhotoPath(docDir, 'ab12-1.jpg')).toBe('file:///doc/exercises/ab12-1.jpg')
    })
})

describe('resolvePulledPhotoUri', () => {
    it('keeps the local file when the pulled key matches the local key', () => {
        expect(resolvePulledPhotoUri('ab12-1.jpg', 'file:///doc/exercises/1.jpg', 'ab12-1.jpg')).toEqual({
            photoUri: 'file:///doc/exercises/1.jpg',
            staleUri: null,
        })
    })

    it('clears the local file and reports it stale when the key changed', () => {
        expect(resolvePulledPhotoUri('ab12-1.jpg', 'file:///doc/exercises/1.jpg', 'ab12-2.jpg')).toEqual({
            photoUri: null,
            staleUri: 'file:///doc/exercises/1.jpg',
        })
    })

    it('clears the local file when the photo was removed remotely', () => {
        expect(resolvePulledPhotoUri('ab12-1.jpg', 'file:///doc/exercises/1.jpg', null)).toEqual({
            photoUri: null,
            staleUri: 'file:///doc/exercises/1.jpg',
        })
    })

    it('is a no-op when there is no local photo', () => {
        expect(resolvePulledPhotoUri(null, null, 'ab12-1.jpg')).toEqual({ photoUri: null, staleUri: null })
    })
})

describe('shouldUploadPhoto', () => {
    it('uploads a locally-captured photo (file name differs from the key)', () => {
        expect(shouldUploadPhoto({ photo_key: 'ab12-1.jpg', photo_uri: 'file:///doc/exercises/1.jpg' })).toBe(true)
    })

    it('skips a hydrated copy (file is named by the key, bytes came from remote)', () => {
        expect(shouldUploadPhoto({ photo_key: 'ab12-1.jpg', photo_uri: 'file:///doc/exercises/ab12-1.jpg' })).toBe(
            false
        )
    })

    it('skips rows without a key or without local bytes', () => {
        expect(shouldUploadPhoto({ photo_key: null, photo_uri: 'file:///doc/exercises/1.jpg' })).toBe(false)
        expect(shouldUploadPhoto({ photo_key: 'ab12-1.jpg', photo_uri: null })).toBe(false)
    })
})
