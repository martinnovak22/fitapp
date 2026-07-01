import type { Exercise } from '@/src/db/exercises'
import type { DuplicateGroup } from './exerciseDedup'
import type { MergeExercisesInput } from './mergeExercises'

// Pure state for the per-group duplicate-review screen. The screen holds these
// items in useState and calls mergeDuplicateExercises with mergeInputFor(item);
// all decision logic lives here so it stays device-independent and testable.

export type ReviewStatus = 'pending' | 'merged' | 'skipped'

export type ReviewItem = {
    normalizedName: string
    members: Exercise[]
    survivorId: number
    status: ReviewStatus
}

export const initReviewItems = (groups: DuplicateGroup[]): ReviewItem[] =>
    groups.map((group) => ({
        normalizedName: group.normalizedName,
        members: group.members,
        survivorId: group.survivor.id,
        status: 'pending',
    }))

export const setSurvivor = (items: ReviewItem[], index: number, survivorId: number): ReviewItem[] =>
    items.map((item, i) => (i === index ? { ...item, survivorId } : item))

export const resolveItem = (
    items: ReviewItem[],
    index: number,
    status: Exclude<ReviewStatus, 'pending'>
): ReviewItem[] => items.map((item, i) => (i === index ? { ...item, status } : item))

export const isReviewComplete = (items: ReviewItem[]): boolean => items.every((item) => item.status !== 'pending')

export const mergeInputFor = (item: ReviewItem): MergeExercisesInput => ({
    survivorId: item.survivorId,
    duplicateIds: item.members.filter((member) => member.id !== item.survivorId).map((member) => member.id),
})
