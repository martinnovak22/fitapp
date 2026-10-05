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

    const show = (request: ConfirmRequest) => {
        queue.push(request)
        if (queue.length === 1) emit()
    }

    const dismiss = () => {
        if (queue.length === 0) return
        queue.shift()
        emit()
    }

    // Closes the dialog first so the action's own UI (navigation, a follow-up
    // dialog) is never covered by this one.
    const confirm = async () => {
        const request = current()
        if (!request) return
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
