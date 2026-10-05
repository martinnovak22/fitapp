// The exercise taxonomy as SelectSheet options: Muscles sectioned by Muscle
// Group (the "Overall" entry stands for the group itself), Equipment with an
// explicit "None" first because it is optional.

import type { TFunction } from 'i18next'
import {
    asEquipment,
    buildMuscleSections,
    EQUIPMENT,
    type Equipment,
    type MuscleKey,
} from '@/src/domain/exerciseTaxonomy'
import type { SelectOption } from '@/src/modules/core/components/selectOptions'
import { equipmentLabel, muscleLabel } from './taxonomyLabels'

// SelectSheet values are strings; "no Equipment" needs one too.
export const NO_EQUIPMENT = ''

export const muscleOptions = (t: TFunction, exclude: readonly MuscleKey[] = []): SelectOption<MuscleKey>[] =>
    buildMuscleSections().flatMap((section) =>
        section.options
            .filter((option) => !exclude.includes(option.key))
            .map((option) => ({
                value: option.key,
                label: option.isWholeGroup ? t('muscleWholeGroup') : muscleLabel(t, option.key),
                section: section.title ? muscleLabel(t, section.title) : undefined,
            }))
    )

export const equipmentOptions = (t: TFunction): SelectOption<Equipment | typeof NO_EQUIPMENT>[] => [
    { value: NO_EQUIPMENT, label: t('none') },
    ...EQUIPMENT.map((equipment) => ({ value: equipment, label: equipmentLabel(t, equipment) })),
]

export const equipmentFromOption = (value: string): Equipment | null => asEquipment(value)
