import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import { EQUIPMENT } from '@/src/domain/exerciseTaxonomy'
import { equipmentFromOption, equipmentOptions, muscleOptions, NO_EQUIPMENT } from '../taxonomyOptions'

// Echo the key so assertions read the mapping, not a translation.
const t = ((key: string) => key) as unknown as TFunction

describe('muscleOptions', () => {
    it('lists the group itself as "Overall" under its own section', () => {
        const back = muscleOptions(t).filter((o) => o.section === 'muscle_back')
        expect(back.map((o) => [o.value, o.label])).toEqual([
            ['back', 'muscleWholeGroup'],
            ['lats', 'muscle_lats'],
            ['upper_back', 'muscle_upper_back'],
            ['lower_back', 'muscle_lower_back'],
        ])
    })

    it('leaves groups without specific muscles unsectioned', () => {
        const unsectioned = muscleOptions(t).filter((o) => o.section === undefined)
        expect(unsectioned.map((o) => o.value)).toEqual(['chest', 'full_body', 'cardio'])
    })

    it('drops excluded muscles', () => {
        const values = muscleOptions(t, ['biceps', 'chest']).map((o) => o.value)
        expect(values).not.toContain('biceps')
        expect(values).not.toContain('chest')
        expect(values).toContain('triceps')
    })
})

describe('equipmentOptions', () => {
    it('offers None first, then every Equipment', () => {
        const options = equipmentOptions(t)
        expect(options[0]).toEqual({ value: NO_EQUIPMENT, label: 'none' })
        expect(options.slice(1).map((o) => o.value)).toEqual([...EQUIPMENT])
    })

    it('maps the None option back to null', () => {
        expect(equipmentFromOption(NO_EQUIPMENT)).toBeNull()
        expect(equipmentFromOption('dumbbell')).toBe('dumbbell')
    })
})
