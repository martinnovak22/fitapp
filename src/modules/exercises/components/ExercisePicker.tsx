import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontSize } from '@/src/constants/Typography'
import type { Exercise } from '@/src/db/exercises'
import { EQUIPMENT, MUSCLE_GROUPS, resolveExerciseMuscles } from '@/src/domain/exerciseTaxonomy'
import { Button } from '@/src/modules/core/components/Button'
import { ListRow } from '@/src/modules/core/components/ListRow'
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
import { equipmentLabel, exerciseSummaryLine, muscleGroupLabel, muscleLabel } from '../taxonomyLabels'

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
    const { theme } = useTheme()
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
        // Search also matches the localized Muscle labels, so "záda" finds a lats Exercise.
        const muscleLabels = (exercise: Exercise) => {
            const { primary, secondary } = resolveExerciseMuscles(exercise)
            return [primary, ...secondary].flatMap((key) => (key ? [muscleLabel(t, key)] : []))
        }
        const matching = filterByFacets(filterExercises(exercises, query, muscleLabels), facets)
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
                    <View style={[styles.search, { backgroundColor: theme.inputBackground }]}>
                        <FontAwesome name={'search'} size={14} color={theme.textSecondary} />
                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            placeholder={t('searchExercises')}
                            placeholderTextColor={theme.textSecondary}
                            style={[styles.searchInput, { color: theme.text }]}
                            selectionColor={theme.primary}
                            autoCorrect={false}
                            returnKeyType={'search'}
                            accessibilityLabel={t('searchExercises')}
                        />
                        {query.length > 0 && (
                            <TouchableOpacity
                                onPress={() => setQuery('')}
                                accessibilityRole={'button'}
                                accessibilityLabel={t('clearSearch')}
                                hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                            >
                                <FontAwesome name={'times-circle'} size={16} color={theme.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>
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

type FilterChipProps = { label: string; active: boolean; onPress: () => void }

function FilterChip({ label, active, onPress }: FilterChipProps) {
    const { theme } = useTheme()
    return (
        <TouchableOpacity
            onPress={onPress}
            style={[
                styles.chip,
                active
                    ? { backgroundColor: `${theme.primary}1F`, borderColor: theme.primary }
                    : { borderColor: theme.border },
            ]}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole={'button'}
            accessibilityState={{ selected: active }}
        >
            <Typography.Label color={active ? 'primary' : 'text'} numberOfLines={1}>
                {label}
            </Typography.Label>
            <FontAwesome name={'caret-down'} size={12} color={active ? theme.primary : theme.textSecondary} />
        </TouchableOpacity>
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
    search: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.md,
        minHeight: 44,
    },
    searchInput: {
        flex: 1,
        fontSize: FontSize.md,
        paddingVertical: Spacing.sm,
    },
    filters: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs + Spacing.xs2,
        minHeight: 36,
        paddingHorizontal: Spacing.sm + Spacing.xs,
        borderRadius: Radius.pill,
        borderWidth: 1,
        maxWidth: '50%',
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
