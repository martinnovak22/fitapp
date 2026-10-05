import { describe, expect, it } from 'vitest'
import cs from '../cs.json'

// Czech typography keeps a one-letter preposition or conjunction (v, k, s, z,
// o, u, i, a) on the line with the next word, so the Czech copy joins them
// with a non-breaking space instead of a plain one.
const LOOSE_ONE_LETTER_WORD = /(^|[\s(])[kKsSvVzZoOuUiIaA] (?=\S)/

describe('Czech copy', () => {
    it('never leaves a one-letter word at the end of a line', () => {
        const loose = Object.entries(cs).filter(([, value]) => LOOSE_ONE_LETTER_WORD.test(value))
        expect(loose).toEqual([])
    })
})
