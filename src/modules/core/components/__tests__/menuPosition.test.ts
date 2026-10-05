import { describe, expect, it } from 'vitest'
import { computeMenuPosition } from '../menuPosition'

const screen = { width: 400, height: 800 }
const menu = { width: 200, height: 120 }

describe('computeMenuPosition', () => {
    it('opens below the anchor with right edges aligned', () => {
        expect(computeMenuPosition({ x: 340, y: 40, width: 48, height: 48 }, screen, menu)).toEqual({
            top: 88,
            left: 188,
        })
    })

    it('keeps the menu inside the screen margin on the right', () => {
        expect(computeMenuPosition({ x: 360, y: 40, width: 48, height: 48 }, screen, menu).left).toBe(192)
    })

    it('keeps the menu inside the screen margin on the left', () => {
        expect(computeMenuPosition({ x: 0, y: 40, width: 48, height: 48 }, screen, menu).left).toBe(8)
    })

    it('flips above the anchor when there is no room below', () => {
        expect(computeMenuPosition({ x: 340, y: 700, width: 48, height: 48 }, screen, menu).top).toBe(580)
    })

    it('pins to the bottom margin when it fits neither below nor above', () => {
        const tall = { width: 200, height: 780 }
        expect(computeMenuPosition({ x: 340, y: 40, width: 48, height: 48 }, screen, tall).top).toBe(12)
    })
})
