import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import { EQUIPMENT, type Equipment } from '@/src/domain/exerciseTaxonomy'
import { equipmentLabel } from '../taxonomyLabels'
import { TaxonomyChip } from './TaxonomyChip'

type Props = {
    value: Equipment | null
    // Tapping the selected chip again clears it: Equipment is optional.
    onChange: (value: Equipment | null) => void
}

export function EquipmentPicker({ value, onChange }: Props) {
    const { t } = useTranslation()
    return (
        <View style={styles.chips} accessibilityRole={'radiogroup'}>
            {EQUIPMENT.map((equipment) => (
                <TaxonomyChip
                    key={equipment}
                    label={equipmentLabel(t, equipment)}
                    selected={value === equipment}
                    onPress={() => onChange(value === equipment ? null : equipment)}
                    role={'radio'}
                />
            ))}
        </View>
    )
}

// Matches the MusclePicker chip rhythm.
const CHIP_GAP = Spacing.xs + Spacing.xs2

const styles = StyleSheet.create({
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: CHIP_GAP,
    },
})
