import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import type { Exercise } from '@/src/db/exercises'
import { EQUIPMENT, MUSCLE_GROUPS } from '@/src/domain/exerciseTaxonomy'
import { Button } from '@/src/modules/core/components/Button'
import { FilterChip } from '@/src/modules/core/components/FilterChip'
import { ListRow } from '@/src/modules/core/components/ListRow'
import { SearchField } from '@/src/modules/core/components/SearchField'
import { Sheet } from '@/src/modules/core/components/Sheet'
import { toggleValue } from '@/src/modules/core/components/selectOptions'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import {
    buildPickerSections,
    type ExerciseFacets,
    filterByFacets,
    filterExercises,
    NO_FACETS,
} from '../exerciseFilters'
import { equipmentLabel, exerciseMuscleLabels, exerciseSummaryLine, muscleGroupLabel } from '../taxonomyLabels'

type ExercisePickerProps = {
    visible: boolean
    onClose: () => void
    title: string
    // The Exercises offered; the caller leaves out ones already added.
    exercises: readonly Exercise[]
    // Listed first under prioritySectionTitle (e.g. a Planned Workout's plan).
    priorityUuids?: readonly string[]
    prioritySectionTitle?: string
    // Called with the chosen Exercises, in list order; the picker then closes.
    onAdd: (exercises: Exercise[]) => void
}

type PickerView = 'list' | 'muscle' | 'equipment'

// The one exercise picker: search, Muscle and Equipment filters, sections by
// Muscle Group, multi-select with a pinned "Add (n)". A filter opens in place
// of the list inside the same sheet, never as a second sheet on top.
export function ExercisePicker({
    visible,
    onClose,
    title,
    exercises,
    priorityUuids = [],
    prioritySectionTitle,
    onAdd,
}: ExercisePickerProps) {
    const { t } = useTranslation()
    const [query, setQuery] = useState('')
    const [facets, setFacets] = useState<ExerciseFacets>(NO_FACETS)
    const [selected, setSelected] = useState<string[]>([])
    const [view, setView] = useState<PickerView>('list')

    // Every opening starts clean.
    useEffect(() => {
        if (!visible) return
        setQuery('')
        setFacets(NO_FACETS)
        setSelected([])
        setView('list')
    }, [visible])

    const sections = useMemo(() => {
        const matching = filterByFacets(
            filterExercises(exercises, query, (exercise) => exerciseMuscleLabels(t, exercise)),
            facets
        )
        return buildPickerSections(matching, priorityUuids)
    }, [exercises, facets, priorityUuids, query, t])

    const handleAdd = () => {
        const chosen = sections.flatMap((section) => section.exercises).filter((e) => selected.includes(e.uuid ?? ''))
        // Selected Exercises hidden by the current search still count.
        const hidden = exercises.filter(
            (e) => selected.includes(e.uuid ?? '') && !chosen.some((c) => c.uuid === e.uuid)
        )
        onAdd([...chosen, ...hidden])
        onClose()
    }

    const footer =
        view === 'list' ? (
            <Button
                label={selected.length > 0 ? t('addCount', { count: selected.length }) : t('add')}
                onPress={handleAdd}
                disabled={selected.length === 0}
            />
        ) : undefined

    return (
        <Sheet visible={visible} onClose={onClose} title={title} tall footer={footer}>
            {view === 'list' ? (
                <>
                    <SearchField value={query} onChangeText={setQuery} placeholder={t('searchExercises')} />
                    <View style={styles.filters}>
                        <FilterChip
                            label={facets.muscleGroup ? muscleGroupLabel(t, facets.muscleGroup) : t('muscle')}
                            active={facets.muscleGroup !== null}
                            onPress={() => setView('muscle')}
                        />
                        <FilterChip
                            label={facets.equipment ? equipmentLabel(t, facets.equipment) : t('equipment')}
                            active={facets.equipment !== null}
                            onPress={() => setView('equipment')}
                        />
                    </View>
                    <ScrollView
                        keyboardShouldPersistTaps={'handled'}
                        style={styles.listScroll}
                        contentContainerStyle={styles.list}
                    >
                        {sections.length === 0 && (
                            <Typography.Body color={'textSecondary'} style={styles.empty}>
                                {t('noResults')}
                            </Typography.Body>
                        )}
                        {sections.map((section) => (
                            <View key={section.key}>
                                <Typography.Label style={styles.sectionTitle} accessibilityRole={'header'}>
                                    {section.isPriority
                                        ? (prioritySectionTitle ?? t('suggested'))
                                        : muscleGroupLabel(t, section.group)}
                                </Typography.Label>
                                {section.exercises.map((exercise) => {
                                    const uuid = exercise.uuid ?? ''
                                    const isSelected = selected.includes(uuid)
                                    return (
                                        <ListRow
                                            key={exercise.id}
                                            label={exercise.name}
                                            subtitle={exerciseSummaryLine(t, exercise)}
                                            accessory={isSelected ? 'check' : 'none'}
                                            onPress={() => uuid && setSelected((current) => toggleValue(current, uuid))}
                                            accessibilityRole={'checkbox'}
                                            accessibilityState={{ checked: isSelected }}
                                        />
                                    )
                                })}
                            </View>
                        ))}
                    </ScrollView>
                </>
            ) : (
                <FacetList
                    title={view === 'muscle' ? t('muscle') : t('equipment')}
                    options={
                        view === 'muscle'
                            ? MUSCLE_GROUPS.map((group) => ({ value: group, label: muscleGroupLabel(t, group) }))
                            : EQUIPMENT.map((equipment) => ({ value: equipment, label: equipmentLabel(t, equipment) }))
                    }
                    value={view === 'muscle' ? facets.muscleGroup : facets.equipment}
                    onBack={() => setView('list')}
                    onSelect={(value) => {
                        setFacets((current) =>
                            view === 'muscle'
                                ? { ...current, muscleGroup: value as ExerciseFacets['muscleGroup'] }
                                : { ...current, equipment: value as ExerciseFacets['equipment'] }
                        )
                        setView('list')
                    }}
                />
            )}
        </Sheet>
    )
}

type FacetListProps = {
    title: string
    options: { value: string; label: string }[]
    value: string | null
    onBack: () => void
    // null clears the filter ("All").
    onSelect: (value: string | null) => void
}

// A filter's choices, shown in place of the exercise list.
function FacetList({ title, options, value, onBack, onSelect }: FacetListProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    return (
        <>
            <TouchableOpacity
                onPress={onBack}
                style={styles.facetBack}
                accessibilityRole={'button'}
                accessibilityLabel={t('back')}
            >
                <FontAwesome name={'chevron-left'} size={14} color={theme.text} />
                <Typography.Body weight={'semibold'}>{title}</Typography.Body>
            </TouchableOpacity>
            <ScrollView style={styles.listScroll} contentContainerStyle={styles.list}>
                <ListRow
                    label={t('all')}
                    accessory={value === null ? 'check' : 'none'}
                    onPress={() => onSelect(null)}
                    accessibilityRole={'radio'}
                    accessibilityState={{ checked: value === null }}
                />
                {options.map((option) => (
                    <ListRow
                        key={option.value}
                        label={option.label}
                        accessory={value === option.value ? 'check' : 'none'}
                        onPress={() => onSelect(option.value)}
                        accessibilityRole={'radio'}
                        accessibilityState={{ checked: value === option.value }}
                    />
                ))}
            </ScrollView>
        </>
    )
}

const styles = StyleSheet.create({
    filters: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    // Rows run edge to edge of the sheet.
    listScroll: {
        marginHorizontal: -Spacing.md,
    },
    list: {
        paddingBottom: Spacing.sm,
    },
    sectionTitle: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.xs,
    },
    empty: {
        textAlign: 'center',
        paddingVertical: Spacing.lg,
    },
    facetBack: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        minHeight: 44,
    },
})
