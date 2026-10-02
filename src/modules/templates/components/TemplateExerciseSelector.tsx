import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontSize } from '@/src/constants/Typography'
import type { Exercise } from '@/src/db/exercises'
import { Button } from '@/src/modules/core/components/Button'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { formatExerciseType, formatMuscleGroup } from '@/src/utils/formatters'
import { filterExercises, groupByMuscle } from '../templateForm'

type Props = {
    exercises: Exercise[]
    selected: ReadonlySet<string>
    onToggle: (uuid: string) => void
}

// Multi-select of a principal's Exercises, searchable and sectioned by muscle
// group so a long list stays scannable. Rendered inline (not virtualized): it
// lives inside the editor's ScrollView, and an Exercise list is tens of rows.
export function TemplateExerciseSelector({ exercises, selected, onToggle }: Props) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const [query, setQuery] = useState('')

    const sections = useMemo(() => groupByMuscle(filterExercises(exercises, query)), [exercises, query])

    return (
        <View style={styles.root}>
            <View style={[styles.search, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
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
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                        <FontAwesome name={'times-circle'} size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {sections.length === 0 ? (
                <View style={styles.noMatch}>
                    <Typography.Meta color={'textSecondary'} style={styles.noMatchText}>
                        {t('noExerciseMatches', { query: query.trim() })}
                    </Typography.Meta>
                    <Button label={t('clearSearch')} variant={'text'} size={'sm'} onPress={() => setQuery('')} />
                </View>
            ) : (
                sections.map((section) => (
                    <View key={section.group ?? '__other'} style={styles.section}>
                        <Typography.Meta weight={'bold'} color={'textSecondary'} style={styles.sectionLabel}>
                            {section.group ? formatMuscleGroup(section.group) : t('otherMuscleGroup')}
                        </Typography.Meta>
                        <View style={[styles.sectionList, { borderColor: theme.border }]}>
                            {section.exercises.map((exercise, index) => {
                                const uuid = exercise.uuid ?? ''
                                const isSelected = selected.has(uuid)
                                return (
                                    <TouchableOpacity
                                        key={exercise.id}
                                        onPress={() => uuid && onToggle(uuid)}
                                        style={[
                                            styles.row,
                                            index > 0 && { borderTopWidth: 1, borderTopColor: `${theme.border}66` },
                                            isSelected && { backgroundColor: `${theme.primary}14` },
                                        ]}
                                        accessibilityRole={'checkbox'}
                                        accessibilityState={{ checked: isSelected }}
                                        accessibilityLabel={exercise.name}
                                    >
                                        <FontAwesome
                                            name={isSelected ? 'check-square' : 'square-o'}
                                            size={20}
                                            color={isSelected ? theme.primary : theme.textSecondary}
                                            style={styles.checkbox}
                                        />
                                        <View style={styles.rowText}>
                                            <Typography.Body weight={'semibold'} numberOfLines={1}>
                                                {exercise.name}
                                            </Typography.Body>
                                            <Typography.Meta color={'textSecondary'} numberOfLines={1}>
                                                {t(formatExerciseType(exercise.type))}
                                            </Typography.Meta>
                                        </View>
                                    </TouchableOpacity>
                                )
                            })}
                        </View>
                    </View>
                ))
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    root: {
        gap: Spacing.md,
    },
    search: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderWidth: 1,
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.md,
    },
    searchInput: {
        flex: 1,
        paddingVertical: Spacing.sm + Spacing.xs,
        fontSize: FontSize.md,
    },
    noMatch: {
        alignItems: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.md,
    },
    noMatchText: {
        textAlign: 'center',
    },
    section: {
        gap: Spacing.xs,
    },
    sectionLabel: {
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectionList: {
        borderWidth: 1,
        borderRadius: Radius.sm,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        gap: Spacing.md,
    },
    checkbox: {
        width: 20,
    },
    rowText: {
        flex: 1,
        minWidth: 0,
    },
})
