import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import type { TFunction } from 'i18next'
import { memo, type ReactNode, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import ReorderableList, { reorderItems, useIsActive, useReorderableDrag } from 'react-native-reorderable-list'
import type { ThemeType } from '@/src/constants/Colors'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import type { Exercise } from '@/src/db/exercises'
import { EQUIPMENT, MUSCLE_GROUPS } from '@/src/domain/exerciseTaxonomy'
import { Button } from '@/src/modules/core/components/Button'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { FilterChip } from '@/src/modules/core/components/FilterChip'
import { InitialsAvatar } from '@/src/modules/core/components/InitialsAvatar'
import { ListRow } from '@/src/modules/core/components/ListRow'
import { groupedRowCorners } from '@/src/modules/core/components/ListSection'
import { OverflowMenu } from '@/src/modules/core/components/OverflowMenu'
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { SearchField } from '@/src/modules/core/components/SearchField'
import { SelectSheet } from '@/src/modules/core/components/SelectSheet'
import { Sheet } from '@/src/modules/core/components/Sheet'
import { Typography } from '@/src/modules/core/components/Typography'
import { useMinimumSkeleton } from '@/src/modules/core/hooks/useMinimumSkeleton'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { exportExercisesToCSV, importExercisesFromCSV } from '@/src/utils/csv'
import { type ExerciseFacets, filterByFacets, filterExercises, NO_FACETS } from '../exerciseFilters'
import { useExercises } from '../hooks/useExercises'
import { equipmentLabel, exerciseMuscleLabels, exerciseSummaryLine, muscleGroupLabel } from '../taxonomyLabels'
import { ExercisesListSkeleton } from './components/ExercisesListSkeleton'

// SelectSheet values are strings; "" clears a filter.
const ANY = '' as const

type RowProps = { item: Exercise; index: number; count: number; theme: ThemeType; t: TFunction }

// The body both row kinds share: avatar, name, summary line and a trailing
// control. The text column carries the separator, so it starts at the text.
function ExerciseRowBody({ item, index, theme, t, trailing }: Omit<RowProps, 'count'> & { trailing: ReactNode }) {
    return (
        <>
            <InitialsAvatar name={item.name} photoUri={item.photo_uri} />
            <View
                style={[
                    styles.rowText,
                    index > 0 && { borderTopColor: theme.hairline, borderTopWidth: StyleSheet.hairlineWidth },
                ]}
            >
                <View style={styles.rowLabels}>
                    <Typography.Body numberOfLines={1}>{item.name}</Typography.Body>
                    <Typography.Meta color={'textSecondary'} numberOfLines={1}>
                        {exerciseSummaryLine(t, item)}
                    </Typography.Meta>
                </View>
                {trailing}
            </View>
        </>
    )
}

const LibraryRow = memo(({ item, index, count, theme, t }: RowProps) => (
    <TouchableOpacity
        onPress={() => router.push(`/(tabs)/exercises/${item.id}`)}
        activeOpacity={0.6}
        style={[styles.row, { backgroundColor: theme.surface }, ...groupedRowCorners(index, count)]}
        accessibilityRole={'button'}
        accessibilityLabel={`${item.name}, ${exerciseSummaryLine(t, item)}`}
    >
        <ExerciseRowBody
            item={item}
            index={index}
            theme={theme}
            t={t}
            trailing={<FontAwesome name={'angle-right'} size={20} color={theme.textSecondary} />}
        />
    </TouchableOpacity>
))
LibraryRow.displayName = 'LibraryRow'

// The same row in edit-order mode: a drag handle instead of the chevron.
const ReorderRow = memo(({ item, index, count, theme, t }: RowProps) => {
    const drag = useReorderableDrag()
    const isActive = useIsActive()
    return (
        <View
            style={[
                styles.row,
                { backgroundColor: isActive ? theme.inputBackgroundActive : theme.surface },
                ...groupedRowCorners(index, count),
            ]}
        >
            <ExerciseRowBody
                item={item}
                index={index}
                theme={theme}
                t={t}
                trailing={
                    <TouchableOpacity
                        onPressIn={drag}
                        style={styles.handle}
                        accessibilityRole={'button'}
                        accessibilityLabel={t('reorderExercise', { name: item.name })}
                        accessibilityHint={t('holdToDrag')}
                    >
                        <FontAwesome name={'bars'} size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                }
            />
        </View>
    )
})
ReorderRow.displayName = 'ReorderRow'

// The Exercise library: search and Muscle / Equipment filters over compact
// rows. Reordering is an explicit mode, import and export sit in the ⋯ menu.
export default function ExercisesListScreen() {
    const { t } = useTranslation()
    const navigation = useNavigation()
    const { theme } = useTheme()
    const { exercises, hasLoaded, loadError, loadExercises, handleReorder, isReordering } = useExercises()
    const showSkeleton = useMinimumSkeleton(!hasLoaded)
    const [query, setQuery] = useState('')
    const [facets, setFacets] = useState<ExerciseFacets>(NO_FACETS)
    const [openFacet, setOpenFacet] = useState<'muscle' | 'equipment' | null>(null)
    const [isEditingOrder, setIsEditingOrder] = useState(false)
    const [exportSheetVisible, setExportSheetVisible] = useState(false)
    const [isImporting, setIsImporting] = useState(false)

    const visible = useMemo(() => {
        return filterByFacets(
            filterExercises(exercises, query, (exercise) => exerciseMuscleLabels(t, exercise)),
            facets
        )
    }, [exercises, facets, query, t])
    const isFiltered = query.trim().length > 0 || facets.muscleGroup !== null || facets.equipment !== null

    const handleExport = useCallback(() => {
        if (Platform.OS === 'android') setExportSheetVisible(true)
        else exportExercisesToCSV(exercises)
    }, [exercises])

    const handleImport = useCallback(async () => {
        if (isImporting) return
        await importExercisesFromCSV(loadExercises, { onProcessingStateChange: setIsImporting })
    }, [isImporting, loadExercises])

    const openNew = useCallback(() => router.push('/(tabs)/exercises/add'), [])

    useFocusEffect(
        useCallback(() => {
            navigation.getParent()?.setOptions({
                headerTitle: t('exercises'),
                headerLeft: () => null,
                headerRight: () =>
                    isEditingOrder ? (
                        <Button
                            label={t('done')}
                            variant={'text'}
                            onPress={() => setIsEditingOrder(false)}
                            style={styles.headerButton}
                        />
                    ) : (
                        <View style={styles.headerActions}>
                            <Button label={t('new')} variant={'text'} onPress={openNew} style={styles.headerButton} />
                            <OverflowMenu
                                placement={'topBar'}
                                items={[
                                    {
                                        key: 'order',
                                        label: t('editOrder'),
                                        icon: 'sort',
                                        disabled: exercises.length < 2,
                                        onPress: () => setIsEditingOrder(true),
                                    },
                                    { key: 'import', label: t('importCsv'), icon: 'download', onPress: handleImport },
                                    {
                                        key: 'export',
                                        label: t('exportCsv'),
                                        icon: 'upload',
                                        disabled: exercises.length === 0,
                                        onPress: handleExport,
                                    },
                                ]}
                            />
                        </View>
                    ),
            })
        }, [exercises.length, handleExport, handleImport, isEditingOrder, navigation, openNew, t])
    )

    // Hold the handle briefly so a vertical swipe still scrolls the list.
    const panGesture = useMemo(() => Gesture.Pan().activateAfterLongPress(150), [])

    const header = (
        <View style={styles.listHeader}>
            <SearchField value={query} onChangeText={setQuery} placeholder={t('searchExercises')} />
            <View style={styles.filters}>
                <FilterChip
                    label={facets.muscleGroup ? muscleGroupLabel(t, facets.muscleGroup) : t('muscle')}
                    active={facets.muscleGroup !== null}
                    onPress={() => setOpenFacet('muscle')}
                />
                <FilterChip
                    label={facets.equipment ? equipmentLabel(t, facets.equipment) : t('equipment')}
                    active={facets.equipment !== null}
                    onPress={() => setOpenFacet('equipment')}
                />
            </View>
        </View>
    )

    const clearFilters = () => {
        setQuery('')
        setFacets(NO_FACETS)
    }

    return (
        <ScreenLayout>
            {showSkeleton ? (
                <ExercisesListSkeleton />
            ) : loadError && exercises.length === 0 ? (
                <View style={styles.centered}>
                    <EmptyState message={loadError} icon={'exclamation-circle'} />
                    <Button label={t('retry')} onPress={loadExercises} />
                </View>
            ) : isEditingOrder ? (
                <ReorderableList
                    data={exercises}
                    onReorder={({ from, to }) => handleReorder(reorderItems(exercises, from, to))}
                    panGesture={panGesture}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item, index }) => (
                        <ReorderRow item={item} index={index} count={exercises.length} theme={theme} t={t} />
                    )}
                    ListHeaderComponent={
                        <Typography.Label color={'textSecondary'} style={styles.reorderHint}>
                            {t('reorderHint')}
                        </Typography.Label>
                    }
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                />
            ) : (
                <FlatList
                    data={visible}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item, index }) => (
                        <LibraryRow item={item} index={index} count={visible.length} theme={theme} t={t} />
                    )}
                    ListHeaderComponent={exercises.length > 0 ? header : null}
                    ListEmptyComponent={
                        exercises.length === 0 ? (
                            <View style={styles.empty}>
                                <Typography.Body color={'textSecondary'} style={styles.emptyText}>
                                    {t('noExercisesYet')}
                                </Typography.Body>
                                <Button
                                    label={t('addExercise')}
                                    leftIcon={'plus'}
                                    variant={'secondary'}
                                    onPress={openNew}
                                />
                            </View>
                        ) : (
                            <View style={styles.empty}>
                                <Typography.Body color={'textSecondary'} style={styles.emptyText}>
                                    {t('noResults')}
                                </Typography.Body>
                                {isFiltered && (
                                    <Button label={t('clearFilters')} variant={'text'} onPress={clearFilters} />
                                )}
                            </View>
                        )
                    }
                    keyboardShouldPersistTaps={'handled'}
                    keyboardDismissMode={'on-drag'}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    onRefresh={loadExercises}
                    refreshing={false}
                />
            )}

            {isReordering && (
                <View style={[styles.savingBadge, { backgroundColor: theme.card }]}>
                    <ActivityIndicator size={'small'} color={theme.textSecondary} />
                    <Typography.Meta color={'text'}>{t('saving')}</Typography.Meta>
                </View>
            )}

            <SelectSheet
                visible={openFacet === 'muscle'}
                onClose={() => setOpenFacet(null)}
                title={t('muscle')}
                mode={'single'}
                searchable={false}
                options={[
                    { value: ANY, label: t('all') },
                    ...MUSCLE_GROUPS.map((group) => ({ value: group, label: muscleGroupLabel(t, group) })),
                ]}
                value={facets.muscleGroup ?? ANY}
                onSelect={(value) =>
                    setFacets((current) => ({
                        ...current,
                        muscleGroup: value === ANY ? null : value,
                    }))
                }
            />
            <SelectSheet
                visible={openFacet === 'equipment'}
                onClose={() => setOpenFacet(null)}
                title={t('equipment')}
                mode={'single'}
                searchable={false}
                options={[
                    { value: ANY, label: t('all') },
                    ...EQUIPMENT.map((equipment) => ({ value: equipment, label: equipmentLabel(t, equipment) })),
                ]}
                value={facets.equipment ?? ANY}
                onSelect={(value) =>
                    setFacets((current) => ({
                        ...current,
                        equipment: value === ANY ? null : value,
                    }))
                }
            />

            <Sheet visible={exportSheetVisible} onClose={() => setExportSheetVisible(false)} title={t('exportCsv')}>
                <View style={styles.sheetRows}>
                    <ListRow
                        label={t('shareFile')}
                        leadingIcon={'share-alt'}
                        onPress={() => {
                            setExportSheetVisible(false)
                            exportExercisesToCSV(exercises, { androidAction: 'share' })
                        }}
                    />
                    <ListRow
                        label={t('saveToPhone')}
                        leadingIcon={'download'}
                        onPress={() => {
                            setExportSheetVisible(false)
                            exportExercisesToCSV(exercises, { androidAction: 'save' })
                        }}
                    />
                </View>
            </Sheet>

            <Modal visible={isImporting} transparent animationType="fade" statusBarTranslucent>
                <View style={[styles.importOverlay, { backgroundColor: theme.overlayScrimLight }]}>
                    <View style={[styles.importCard, { backgroundColor: theme.surface }]}>
                        <ActivityIndicator size={'large'} color={theme.primary} />
                        <Typography.Label color={'text'} style={styles.emptyText}>
                            {t('importInProgress')}
                        </Typography.Label>
                    </View>
                </View>
            </Modal>
        </ScreenLayout>
    )
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        gap: Spacing.md,
    },
    listContent: {
        paddingBottom: Spacing.xl,
    },
    listHeader: {
        gap: Spacing.sm + Spacing.xs,
        paddingBottom: Spacing.md,
    },
    filters: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm + Spacing.xs,
        paddingLeft: Spacing.md,
    },
    rowText: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        minHeight: 64,
        paddingRight: Spacing.md,
    },
    rowLabels: {
        flex: 1,
        minWidth: 0,
        gap: Spacing.xs2,
    },
    handle: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: -Spacing.sm,
    },
    reorderHint: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm + Spacing.xs,
    },
    empty: {
        gap: Spacing.md,
        paddingTop: Spacing.lg,
    },
    emptyText: {
        textAlign: 'center',
    },
    savingBadge: {
        position: 'absolute',
        top: Spacing.md,
        right: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        borderRadius: Radius.pill,
    },
    sheetRows: {
        marginHorizontal: -Spacing.md,
    },
    importOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    importCard: {
        minWidth: 220,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        gap: Spacing.sm,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: Spacing.xs,
    },
    headerButton: {
        minHeight: 44,
        paddingHorizontal: Spacing.sm,
    },
})
