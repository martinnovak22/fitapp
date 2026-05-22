// Minimal cycle driver: walks an Outbox batch, lets callers push each row, and
// aborts cleanly when the live principal diverges from the captured snapshot.
// The richer SyncCycle from the PRD (push-then-pull, conflict rules) will land
// in a later slice; this slice extracts just enough to enforce abort discipline.

import type { Outbox, OutboxRow, SyncFailureReason } from './Outbox'
import {
    type LivePrincipal,
    type PrincipalSnapshot,
    principalHasDiverged,
} from './PrincipalSnapshot'

export type PushOutcome =
    | { kind: 'ack' }
    | { kind: 'fail'; reason: SyncFailureReason }

export type PushFn = (row: OutboxRow) => Promise<PushOutcome>

export type CycleResult = {
    aborted: boolean
    processed: number
    acked: number
    failed: number
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
    const fails: { row: OutboxRow; reason: SyncFailureReason }[] = []
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
        else fails.push({ row, reason: outcome.reason })
    }

    await outbox.ack(acks)
    // Group failures by reason so ack/fail order is deterministic.
    for (const { row, reason } of fails) {
        await outbox.fail([row], reason)
    }

    return { aborted, processed, acked: acks.length, failed: fails.length }
}
