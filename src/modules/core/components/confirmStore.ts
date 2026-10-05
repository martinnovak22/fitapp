// State behind ConfirmDialog. The dialog is imperative (`confirmDialog(...)`)
// so call sites keep their callback shape, and a single host renders it.
// Requests made while one is open queue up instead of replacing it, so a
// confirmation is never silently dropped.

export type ConfirmRequest = {
    title: string
    // Say what will be lost, not just "are you sure".
    message?: string
    confirmLabel: string
    cancelLabel?: string
    // Destructive actions render the confirm button in the error colour.
    destructive?: boolean
    onConfirm: () => void | Promise<void>
}

type Listener = (current: ConfirmRequest | null) => void

export const createConfirmStore = () => {
    const queue: ConfirmRequest[] = []
    const listeners = new Set<Listener>()

    const current = (): ConfirmRequest | null => queue[0] ?? null
    const emit = () => {
        const value = current()
        for (const listener of listeners) listener(value)
    }

    // The same question asked again while it is open or queued (Finish
    // tapped twice) is shown once, so its action cannot run twice.
    const show = (request: ConfirmRequest) => {
        if (queue.some((queued) => queued.title === request.title && queued.message === request.message)) return
        queue.push(request)
        if (queue.length === 1) emit()
    }

    // Both take the request the dialog showed when tapped, so a second tap
    // landing after the next queued request took its place does nothing.
    const isCurrent = (expected?: ConfirmRequest) => queue.length > 0 && (!expected || expected === queue[0])

    const dismiss = (expected?: ConfirmRequest) => {
        if (!isCurrent(expected)) return
        queue.shift()
        emit()
    }

    // Closes the dialog first so the action's own UI (navigation, a follow-up
    // dialog) is never covered by this one.
    const confirm = async (expected?: ConfirmRequest) => {
        const request = current()
        if (!request || !isCurrent(expected)) return
        dismiss()
        await request.onConfirm()
    }

    const subscribe = (listener: Listener) => {
        listeners.add(listener)
        return () => {
            listeners.delete(listener)
        }
    }

    return { show, dismiss, confirm, current, subscribe }
}

export type ConfirmStore = ReturnType<typeof createConfirmStore>
