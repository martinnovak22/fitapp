import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import { buildMuscleSections, type MuscleKey } from '@/src/domain/exerciseTaxonomy'
import { Typography } from '@/src/modules/core/components/Typography'
import { muscleLabel } from '../taxonomyLabels'
import { TaxonomyChip } from './TaxonomyChip'

type Props = {
    selected: readonly MuscleKey[]
    onToggle: (key: MuscleKey) => void
    mode: 'single' | 'multi'
    // Shown but not selectable, e.g. the primary Muscle inside the secondary picker.
    disabledKeys?: readonly MuscleKey[]
}

// The muscle taxonomy as chips, sectioned by Muscle Group (see
// buildMuscleSections for the layout rules).
export function MusclePicker({ selected, onToggle, mode, disabledKeys = [] }: Props) {
    const { t } = useTranslation()
    const sections = useMemo(buildMuscleSections, [])

    return (
        <View style={styles.root}>
            {sections.map((section, index) => (
                <View key={section.title ?? `flat-${index}`} style={styles.section}>
                    {section.title && (
                        <Typography.Meta weight={'bold'} color={'textSecondary'} style={styles.sectionTitle}>
                            {muscleLabel(t, section.title)}
                        </Typography.Meta>
                    )}
                    <View style={styles.chips} accessibilityRole={mode === 'single' ? 'radiogroup' : undefined}>
                        {section.options.map((option) => (
                            <TaxonomyChip
                                key={option.key}
                                label={option.isWholeGroup ? t('muscleWholeGroup') : muscleLabel(t, option.key)}
                                // "Overall" leans on the heading; a screen reader hears it alone.
                                accessibilityLabel={
                                    option.isWholeGroup
                                        ? `${muscleLabel(t, option.key)}, ${t('muscleWholeGroup')}`
                                        : undefined
                                }
                                selected={selected.includes(option.key)}
                                disabled={disabledKeys.includes(option.key)}
                                onPress={() => onToggle(option.key)}
                                role={mode === 'single' ? 'radio' : 'checkbox'}
                            />
                        ))}
                    </View>
                </View>
            ))}
        </View>
    )
}

// Chips sit tighter than form fields: halfway between xs and sm.
const CHIP_GAP = Spacing.xs + Spacing.xs2

const styles = StyleSheet.create({
    root: {
        gap: Spacing.md,
    },
    section: {
        gap: CHIP_GAP,
    },
    sectionTitle: {
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: CHIP_GAP,
    },
})
