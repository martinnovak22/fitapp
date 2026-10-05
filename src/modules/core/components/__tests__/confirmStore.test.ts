import { describe, expect, it, vi } from 'vitest'
import { type ConfirmRequest, createConfirmStore } from '../confirmStore'

const request = (title: string, onConfirm: ConfirmRequest['onConfirm'] = () => {}): ConfirmRequest => ({
    title,
    confirmLabel: 'OK',
    onConfirm,
})

describe('createConfirmStore', () => {
    it('shows a request and notifies subscribers', () => {
        const store = createConfirmStore()
        const listener = vi.fn()
        store.subscribe(listener)
        store.show(request('A'))
        expect(store.current()?.title).toBe('A')
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ title: 'A' }))
    })

    it('queues a second request behind the open one', () => {
        const store = createConfirmStore()
        store.show(request('A'))
        store.show(request('B'))
        expect(store.current()?.title).toBe('A')
        store.dismiss()
        expect(store.current()?.title).toBe('B')
        store.dismiss()
        expect(store.current()).toBeNull()
    })

    it('closes before running the action, and runs it once', async () => {
        const store = createConfirmStore()
        const seen: (string | null)[] = []
        store.show(
            request('A', () => {
                seen.push(store.current()?.title ?? null)
            })
        )
        await store.confirm()
        await store.confirm()
        expect(seen).toEqual([null])
    })

    it('ignores a second tap meant for the request that already closed', async () => {
        const store = createConfirmStore()
        const first = request('A')
        const second = vi.fn()
        store.show(first)
        store.show(request('B', second))
        await store.confirm(first)
        await store.confirm(first)
        store.dismiss(first)
        expect(second).not.toHaveBeenCalled()
        expect(store.current()?.title).toBe('B')
    })

    it('shows the same question once while it is open', () => {
        const store = createConfirmStore()
        store.show(request('A'))
        store.show(request('A'))
        store.dismiss()
        expect(store.current()).toBeNull()
    })

    it('dismiss does not run the action', () => {
        const store = createConfirmStore()
        const onConfirm = vi.fn()
        store.show(request('A', onConfirm))
        store.dismiss()
        expect(onConfirm).not.toHaveBeenCalled()
    })

    it('stops notifying after unsubscribe', () => {
        const store = createConfirmStore()
        const listener = vi.fn()
        const unsubscribe = store.subscribe(listener)
        unsubscribe()
        store.show(request('A'))
        expect(listener).not.toHaveBeenCalled()
    })
})
