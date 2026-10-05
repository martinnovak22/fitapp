import { describe, expect, it } from 'vitest'
import { foldText } from '../foldText'

describe('foldText', () => {
    it('folds diacritics, case and whitespace', () => {
        expect(foldText('  Široký   Sval ')).toBe('siroky sval')
        expect(foldText('DŘEP')).toBe('drep')
    })
})
