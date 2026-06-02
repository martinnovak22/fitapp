// Minimal cycle driver: walks an Outbox batch, lets callers push each row, and
// aborts cleanly when the live principal diverges from the captured snapshot.
// The richer SyncCycle from the PRD (push-then-pull, conflict rules) will land
// in a later slice; this slice extracts just enough to enforce abort discipline.

import type { Outbox, OutboxRow, SyncFailureReason } from './Outbox'
import { type LivePrincipal, type PrincipalSnapshot, principalHasDiverged } from './PrincipalSnapshot'

export type PushOutcome = { kind: 'ack' } | { kind: 'fail'; reason: SyncFailureReason }

export type PushFn = (row: OutboxRow) => Promise<PushOutcome>

export type CycleFailure = { row: OutboxRow; reason: SyncFailureReason; blocked: boolean }

export type CycleResult = {
    aborted: boolean
    processed: number
    acked: number
    failed: number
    // Of the failures, how many were parked as 'blocked' (given up on) rather
    // than left to retry. blocked rows do not raise the failed banner.
    blocked: number
    failures: CycleFailure[]
}

export const drainOutbox = async (
    outbox: Outbox,
    snapshot: PrincipalSnapshot,
    push: PushFn,
    getLivePrincipal: () => LivePrincipal,
    onBatchLoaded?: (batch: OutboxRow[]) => Promise<void> | void
): Promise<CycleResult> => {
    const batch = await outbox.nextBatch(snapshot)
    if (onBatchLoaded) await onBatchLoaded(batch)
    const acks: OutboxRow[] = []
    const rawFails: { row: OutboxRow; reason: SyncFailureReason }[] = []
    let processed = 0
    let aborted = false

    for (const row of batch) {
        if (principalHasDiverged(snapshot, getLivePrincipal())) {
            aborted = true
            break
        }
        const outcome = await push(row)
        processed += 1
        if (outcome.kind === 'ack') acks.push(row)
        else rawFails.push({ row, reason: outcome.reason })
    }

    await outbox.ack(acks)
    // Record failures one at a time so the persisted attempt/blocked status is
    // deterministic, and capture each row's disposition so the caller can tell
    // retryable failures (raise the banner) from blocked ones (parked quietly).
    const failures: CycleFailure[] = []
    for (const { row, reason } of rawFails) {
        const [disposition] = await outbox.fail([row], reason)
        failures.push({ row, reason, blocked: disposition?.status === 'blocked' })
    }
    const blocked = failures.filter((f) => f.blocked).length

    return { aborted, processed, acked: acks.length, failed: failures.length, blocked, failures }
}
