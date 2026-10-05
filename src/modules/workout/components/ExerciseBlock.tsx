import FontAwesome from '@expo/vector-icons/FontAwesome'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type StyleProp, StyleSheet, TextInput, TouchableOpacity, View, type ViewStyle } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontSize, FontWeight } from '@/src/constants/Typography'
import type { Exercise } from '@/src/db/exercises'
import type { SetWithExerciseName, Set as WorkoutSet } from '@/src/db/workouts'
import { Collapsible } from '@/src/modules/core/components/motion'
import { OverflowMenu, type OverflowMenuItem } from '@/src/modules/core/components/OverflowMenu'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import {
    type BlockRow,
    type DraftRow,
    formatPrevious,
    mergeLoggedEdit,
    rowPayload,
    type SubSetValues,
    subSetValuesFrom,
    valuesFromSet,
} from '../liveWorkout'
import type { SetFormValues } from '../setPayload'
import { parseSubSets } from '../workoutUtils'
import { resolveSetColumns, type SetColumn, SUB_SET_COLUMNS } from './setColumns'

export type ExerciseBlockHandlers = {
    onLogDraft: (exercise: Exercise, row: DraftRow) => void
    // Carries what the row shows, which may hold an edit not yet saved.
    onUnlog: (
        exercise: Exercise,
        set: SetWithExerciseName,
        values: SetFormValues,
        subSets: SubSetValues[] | null
    ) => void
    // Resolves false when the save failed, so the row shows the stored values again.
    onEditLogged: (
        exercise: Exercise,
        set: SetWithExerciseName,
        values: SetFormValues,
        subSets: SubSetValues[] | null
    ) => Promise<boolean>
    onDeleteLogged: (set: SetWithExerciseName) => void
    // A logged row hands over how to save what is still being typed; the
    // returned function unregisters it.
    // The flush resolves to whether the row's values are stored.
    onRegisterFlush: (flush: () => Promise<boolean>) => () => void
    onDraftValue: (exerciseId: number, key: string, field: keyof SetFormValues, value: string) => void
    onDraftCopy: (exerciseId: number, key: string, values: SetFormValues) => void
    onDraftToggleDrop: (exerciseId: number, key: string) => void
    onDraftSubSet: (exerciseId: number, key: string, index: number, field: keyof SubSetValues, value: string) => void
    onDraftAddSubSet: (exerciseId: number, key: string) => void
    onDraftRemoveSubSet: (exerciseId: number, key: string, index: number) => void
    onDraftRemove: (exerciseId: number, key: string) => void
    onAddSet: (exercise: Exercise) => void
    onRemoveExercise: (exercise: Exercise, loggedCount: number) => void
}

type ExerciseBlockProps = ExerciseBlockHandlers & {
    exercise: Exercise
    // Logged Sets and draft rows in the order they are shown; a Set checked
    // out of order keeps its row.
    rows: BlockRow<SetWithExerciseName>[]
    // The Sets of last time, by row.
    previous: readonly WorkoutSet[]
    readOnly: boolean
}

// One Exercise of a Workout as a set table: SET | PREVIOUS | inputs | ✓.
// Logged rows (Sets) and unchecked draft rows share the layout; ✓ turns a
// draft into a Set, and unticking a Set turns it back into a draft.
function ExerciseBlockInner(props: ExerciseBlockProps) {
    const { exercise, rows, previous, readOnly } = props
    const loggedCount = rows.filter((row) => row.kind === 'set').length
    const { t } = useTranslation()
    const { theme } = useTheme()
    const columns = resolveSetColumns(exercise.type)

    const menuItems: OverflowMenuItem[] = [
        {
            key: 'remove',
            label: t('removeExercise'),
            icon: 'trash',
            destructive: true,
            onPress: () => props.onRemoveExercise(exercise, loggedCount),
        },
    ]

    return (
        <View style={[styles.block, { backgroundColor: theme.surface }]}>
            <View style={styles.header}>
                <Typography.Body weight={'semibold'} numberOfLines={1} style={styles.title}>
                    {exercise.name}
                </Typography.Body>
                {!readOnly && <OverflowMenu items={menuItems} accessibilityLabel={t('exerciseActions')} />}
            </View>

            <View style={styles.row}>
                <ColumnLabel style={styles.setCell}>{t('colSet')}</ColumnLabel>
                {!readOnly && (
                    <ColumnLabel style={[styles.previousCell, styles.previousLabel]}>{t('colPrevious')}</ColumnLabel>
                )}
                {columns.map((column) => (
                    <ColumnLabel key={column.key} style={styles.inputCell}>
                        {t(column.labelKey)}
                    </ColumnLabel>
                ))}
                {!readOnly && <View style={styles.checkCell} />}
            </View>

            {rows.map((blockRow, index) => {
                if (blockRow.kind === 'set') {
                    const { set } = blockRow
                    return (
                        <LoggedSet
                            key={set.id}
                            exercise={exercise}
                            set={set}
                            index={index}
                            columns={columns}
                            previousLabel={formatPrevious(exercise.type, previous[index])}
                            readOnly={readOnly}
                            onEditLogged={props.onEditLogged}
                            onUnlog={props.onUnlog}
                            onDeleteLogged={props.onDeleteLogged}
                            onRegisterFlush={props.onRegisterFlush}
                        />
                    )
                }
                if (readOnly) return null
                const { row } = blockRow
                const previousSet = previous[index]
                return (
                    <View key={row.key}>
                        <SetRow
                            label={row.subSets ? t('dropSetMarker') : String(index + 1)}
                            previousLabel={formatPrevious(exercise.type, previousSet)}
                            onCopyPrevious={
                                previousSet
                                    ? () => props.onDraftCopy(exercise.id, row.key, valuesFromSet(previousSet))
                                    : undefined
                            }
                            columns={columns}
                            values={row.values}
                            logged={false}
                            readOnly={false}
                            onChange={(field, value) => props.onDraftValue(exercise.id, row.key, field, value)}
                            onToggle={() => props.onLogDraft(exercise, row)}
                            menuItems={[
                                {
                                    key: 'drop',
                                    label: row.subSets ? t('normalSet') : t('dropSet'),
                                    icon: row.subSets ? 'minus' : 'level-down',
                                    onPress: () => props.onDraftToggleDrop(exercise.id, row.key),
                                },
                                {
                                    key: 'delete',
                                    label: t('deleteSet'),
                                    icon: 'trash',
                                    destructive: true,
                                    onPress: () => props.onDraftRemove(exercise.id, row.key),
                                },
                            ]}
                        />
                        <Collapsible expanded={row.subSets !== null}>
                            {row.subSets?.map((sub, subIndex) => (
                                <SubSetRow
                                    // biome-ignore lint/suspicious/noArrayIndexKey: drop stages have no identity but their order
                                    key={subIndex}
                                    index={subIndex}
                                    values={sub}
                                    logged={false}
                                    readOnly={false}
                                    onChange={(field, value) =>
                                        props.onDraftSubSet(exercise.id, row.key, subIndex, field, value)
                                    }
                                    onRemove={() => props.onDraftRemoveSubSet(exercise.id, row.key, subIndex)}
                                />
                            ))}
                            <View style={styles.addDropRow}>
                                <TouchableOpacity
                                    onPress={() => props.onDraftAddSubSet(exercise.id, row.key)}
                                    style={styles.addDrop}
                                    accessibilityRole={'button'}
                                >
                                    <Typography.Label color={'textSecondary'}>{t('addDrop')}</Typography.Label>
                                </TouchableOpacity>
                            </View>
                        </Collapsible>
                    </View>
                )
            })}

            {!readOnly && (
                <View style={styles.addSetRow}>
                    <TouchableOpacity
                        onPress={() => props.onAddSet(exercise)}
                        style={[styles.addSet, { backgroundColor: theme.inputBackground }]}
                        accessibilityRole={'button'}
                        accessibilityLabel={t('addSetTo', { name: exercise.name })}
                    >
                        <FontAwesome name={'plus'} size={12} color={theme.text} />
                        <Typography.Label color={'text'} weight={'semibold'}>
                            {t('addSet')}
                        </Typography.Label>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    )
}

export const ExerciseBlock = memo(ExerciseBlockInner)

type LoggedSetProps = Pick<ExerciseBlockHandlers, 'onEditLogged' | 'onUnlog' | 'onDeleteLogged' | 'onRegisterFlush'> & {
    exercise: Exercise
    set: SetWithExerciseName
    index: number
    columns: SetColumn[]
    previousLabel: string
    readOnly: boolean
}

// A logged Set with its drop stages. The row keeps what its inputs show, so
// moving between fields never remounts it; it saves the whole row, and a
// failed save puts the stored values back.
function LoggedSet({
    exercise,
    set,
    index,
    columns,
    previousLabel,
    readOnly,
    onEditLogged,
    onUnlog,
    onDeleteLogged,
    onRegisterFlush,
}: LoggedSetProps) {
    const { t } = useTranslation()
    const stored = useMemo(() => valuesFromSet(set), [set])
    const storedSubs = useMemo(() => {
        const subSets = parseSubSets(set.sub_sets)
        return subSets.length > 0 ? subSetValuesFrom(subSets) : null
    }, [set])
    const storedKey = JSON.stringify([stored, storedSubs])

    const [values, setValues] = useState(stored)
    const [subValues, setSubValues] = useState(storedSubs)
    type RowValues = { values: SetFormValues; subSets: SubSetValues[] | null }

    // What a row's values write, so "82,5" and "82.5" count as the same.
    const payloadKey = (row: RowValues) => JSON.stringify(rowPayload(exercise.type, row.values, row.subSets).data)
    // The payload last written (or stored), so the same edit is not written twice.
    const lastWritten = useRef<string | null>(null)

    // While the user edits the row, it shows what they typed and nothing
    // stored replaces it: a save of "82," comes back as 82, and showing that
    // mid-typing would turn the next "5" into 825. Once the row's last save
    // has landed, it shows the stored Set again (this device or another one).
    const [dirty, setDirty] = useState(false)
    const [needsResync, setNeedsResync] = useState(false)
    const [shownKey, setShownKey] = useState(storedKey)
    if (!dirty && (shownKey !== storedKey || needsResync)) {
        // Another device may have changed the Set; compare with what is stored now.
        if (shownKey !== storedKey) lastWritten.current = null
        setShownKey(storedKey)
        setNeedsResync(false)
        setValues(stored)
        setSubValues(storedSubs)
    }

    const latest = useRef<RowValues>({ values, subSets: subValues })
    latest.current = { values, subSets: subValues }
    const storedRef = useRef({ values: stored, subSets: storedSubs })
    storedRef.current = { values: stored, subSets: storedSubs }
    const onEditRef = useRef(onEditLogged)
    onEditRef.current = onEditLogged
    // Bumped on every keystroke, so a save only ends the edit it was made for.
    const editVersion = useRef(0)

    // A field cleared to nothing keeps its stored value.
    const merged = (current: RowValues): RowValues => ({
        values: mergeLoggedEdit(storedRef.current.values, current.values),
        subSets:
            current.subSets && storedRef.current.subSets
                ? current.subSets.map((sub, i) => mergeLoggedEdit(storedRef.current.subSets?.[i] ?? sub, sub))
                : current.subSets,
    })

    // Saves run one after another, so their results land in order. Each
    // resolves to whether the row's values are now stored.
    const queue = useRef<Promise<boolean>>(Promise.resolve(true))
    const save = (next: RowValues, endsEdit: boolean) => {
        const version = editVersion.current
        queue.current = queue.current.then(async () => {
            const key = payloadKey(next)
            const unchanged = key === (lastWritten.current ?? payloadKey(storedRef.current))
            const saved = unchanged || (await onEditRef.current(exercise, set, next.values, next.subSets))
            if (!saved) {
                lastWritten.current = null
                setValues(storedRef.current.values)
                setSubValues(storedRef.current.subSets)
                setDirty(false)
                return false
            }
            lastWritten.current = key
            if (endsEdit && version === editVersion.current) {
                setDirty(false)
                setNeedsResync(true)
            }
            return true
        })
        return queue.current
    }

    // Typing saves after a short pause, since hiding the keyboard (Android
    // back) keeps the field focused and never ends the edit.
    const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null)
    const cancelPending = () => {
        if (pendingSave.current) clearTimeout(pendingSave.current)
        pendingSave.current = null
    }
    const onType = () => {
        editVersion.current += 1
        setDirty(true)
        cancelPending()
        pendingSave.current = setTimeout(() => {
            pendingSave.current = null
            save(merged(latest.current), false)
        }, LOGGED_SAVE_DELAY_MS)
    }

    // Ending an edit saves at once and shows a cleared field's stored value again.
    // The edit version the last end-edit save was made for: blur, Finish and
    // Done can all end the same edit, and it is saved once.
    const committedVersion = useRef(0)
    const commit = () => {
        if (!dirty || committedVersion.current === editVersion.current) return queue.current
        committedVersion.current = editVersion.current
        cancelPending()
        const next = merged(latest.current)
        setValues(next.values)
        setSubValues(next.subSets)
        return save(next, true)
    }
    const flush = useRef(commit)
    flush.current = commit
    const isDirty = useRef(dirty)
    isDirty.current = dirty

    // Finish asks every row to save what is still being typed first.
    useEffect(
        () => onRegisterFlush(() => (isDirty.current || pendingSave.current ? flush.current() : queue.current)),
        [onRegisterFlush]
    )
    // Leaving the screen saves what is still pending.
    const saveOnLeave = useRef(() => {})
    saveOnLeave.current = () => {
        if (!pendingSave.current) return
        cancelPending()
        save(merged(latest.current), false)
    }
    useEffect(() => () => saveOnLeave.current(), [])

    const label = storedSubs ? t('dropSetMarker') : String(index + 1)
    return (
        <View>
            <SetRow
                label={label}
                previousLabel={previousLabel}
                columns={columns}
                values={values}
                logged
                readOnly={readOnly}
                onChange={(field, value) => {
                    setValues((current) => ({ ...current, [field]: value }))
                    onType()
                }}
                onEndEditing={commit}
                onToggle={() => {
                    cancelPending()
                    const next = merged(latest.current)
                    onUnlog(exercise, set, next.values, next.subSets)
                }}
                menuItems={[
                    {
                        key: 'delete',
                        label: t('deleteSet'),
                        icon: 'trash',
                        destructive: true,
                        onPress: () => onDeleteLogged(set),
                    },
                ]}
            />
            {subValues?.map((sub, subIndex) => (
                <SubSetRow
                    // biome-ignore lint/suspicious/noArrayIndexKey: drop stages have no identity but their order
                    key={subIndex}
                    index={subIndex}
                    values={sub}
                    logged
                    readOnly={readOnly}
                    onChange={(field, value) => {
                        setSubValues(
                            (current) =>
                                current?.map((s, i) => (i === subIndex ? { ...s, [field]: value } : s)) ?? current
                        )
                        onType()
                    }}
                    onEndEditing={commit}
                />
            ))}
        </View>
    )
}

function ColumnLabel({ children, style }: { children: string; style: StyleProp<ViewStyle> }) {
    return (
        <View style={style}>
            <Typography.Meta color={'textSecondary'} weight={'semibold'} numberOfLines={1} style={styles.columnLabel}>
                {children}
            </Typography.Meta>
        </View>
    )
}

type SetRowProps = {
    label: string
    previousLabel: string
    onCopyPrevious?: () => void
    columns: SetColumn[]
    values: SetFormValues
    logged: boolean
    readOnly: boolean
    onChange?: (field: keyof SetFormValues, value: string) => void
    // Logged rows save once editing a field ends.
    onEndEditing?: () => void
    onToggle: () => void
    menuItems: OverflowMenuItem[]
}

function SetRow({
    label,
    previousLabel,
    onCopyPrevious,
    columns,
    values,
    logged,
    readOnly,
    onChange,
    onEndEditing,
    onToggle,
    menuItems,
}: SetRowProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()

    return (
        <View
            style={[
                styles.row,
                readOnly ? styles.readOnlyRow : styles.setRow,
                logged && !readOnly && { backgroundColor: theme.primaryTint },
            ]}
        >
            {readOnly ? (
                <View style={styles.setCell}>
                    <Typography.Label color={'textSecondary'} weight={'semibold'} numeric>
                        {label}
                    </Typography.Label>
                </View>
            ) : (
                <OverflowMenu
                    items={menuItems}
                    accessibilityLabel={t('setActions', { set: label })}
                    triggerStyle={styles.setCell}
                    trigger={
                        <Typography.Label color={'textSecondary'} weight={'semibold'} numeric>
                            {label}
                        </Typography.Label>
                    }
                />
            )}
            {!readOnly && (
                <TouchableOpacity
                    style={styles.previousCell}
                    onPress={onCopyPrevious}
                    disabled={!onCopyPrevious}
                    accessibilityRole={onCopyPrevious ? 'button' : undefined}
                    accessibilityLabel={onCopyPrevious ? t('copyPrevious', { value: previousLabel }) : undefined}
                >
                    <Typography.Label color={'textSecondary'} numberOfLines={1} numeric>
                        {previousLabel}
                    </Typography.Label>
                </TouchableOpacity>
            )}
            {columns.map((column) => (
                <View key={column.key} style={styles.inputCell}>
                    {readOnly ? (
                        <Typography.Body numeric style={styles.readOnlyValue}>
                            {values[column.key] || '—'}
                        </Typography.Body>
                    ) : (
                        <TextInput
                            value={values[column.key]}
                            onChangeText={(next) => onChange?.(column.key, next)}
                            onEndEditing={onEndEditing}
                            keyboardType={column.keyboard}
                            selectTextOnFocus
                            placeholder={'–'}
                            placeholderTextColor={theme.textSecondary}
                            selectionColor={theme.primary}
                            style={[styles.input, { color: theme.text, backgroundColor: theme.inputBackground }]}
                            accessibilityLabel={`${t(column.labelKey)}, ${t('set')} ${label}`}
                        />
                    )}
                </View>
            ))}
            {!readOnly && (
                <TouchableOpacity
                    onPress={onToggle}
                    style={[styles.check, { backgroundColor: logged ? theme.primary : theme.inputBackground }]}
                    accessibilityRole={'checkbox'}
                    accessibilityState={{ checked: logged }}
                    accessibilityLabel={t('completeSet', { set: label })}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                    <FontAwesome name={'check'} size={16} color={logged ? theme.onPrimary : theme.textSecondary} />
                </TouchableOpacity>
            )}
        </View>
    )
}

type SubSetRowProps = {
    index: number
    values: SubSetValues
    logged: boolean
    readOnly: boolean
    onChange?: (field: keyof SubSetValues, value: string) => void
    onEndEditing?: () => void
    onRemove?: () => void
}

// A drop stage under its set row: weight and reps only.
function SubSetRow({ index, values, logged, readOnly, onChange, onEndEditing, onRemove }: SubSetRowProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    return (
        <View
            style={[
                styles.row,
                readOnly ? styles.readOnlyRow : styles.subRow,
                logged && !readOnly && { backgroundColor: theme.primaryTint },
            ]}
        >
            <View style={styles.setCell}>
                <FontAwesome name={'level-up'} size={12} color={theme.textSecondary} style={styles.subMarker} />
            </View>
            {!readOnly && (
                <View style={styles.previousCell}>
                    <Typography.Meta color={'textSecondary'}>{t('dropStage', { n: index + 1 })}</Typography.Meta>
                </View>
            )}
            {SUB_SET_COLUMNS.map((column) => {
                const field = column.key as keyof SubSetValues
                return (
                    <View key={column.key} style={styles.inputCell}>
                        {readOnly ? (
                            <Typography.Body numeric style={styles.readOnlyValue}>
                                {values[field] || '—'}
                            </Typography.Body>
                        ) : (
                            <TextInput
                                value={values[field]}
                                onChangeText={(next) => onChange?.(field, next)}
                                onEndEditing={onEndEditing}
                                keyboardType={column.keyboard}
                                selectTextOnFocus
                                placeholder={'–'}
                                placeholderTextColor={theme.textSecondary}
                                selectionColor={theme.primary}
                                style={[styles.input, { color: theme.text, backgroundColor: theme.inputBackground }]}
                                accessibilityLabel={`${t(column.labelKey)}, ${t('dropStage', { n: index + 1 })}`}
                            />
                        )}
                    </View>
                )
            })}
            {!readOnly && (
                <View style={styles.checkCell}>
                    {onRemove && (
                        <TouchableOpacity
                            onPress={onRemove}
                            style={styles.removeSub}
                            accessibilityRole={'button'}
                            accessibilityLabel={t('removeDrop', { n: index + 1 })}
                        >
                            <FontAwesome name={'times'} size={14} color={theme.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    )
}

// How long a logged row waits after the last keystroke before it saves.
const LOGGED_SAVE_DELAY_MS = 800

const CELL_GAP = Spacing.sm
const INPUT_HEIGHT = 40

const styles = StyleSheet.create({
    block: {
        borderRadius: Radius.md,
        paddingTop: Spacing.xs,
        paddingBottom: Spacing.sm + Spacing.xs,
        gap: Spacing.xs2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: Spacing.md,
        paddingRight: Spacing.xs,
        minHeight: 48,
    },
    title: {
        flex: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: CELL_GAP,
        paddingHorizontal: Spacing.sm + Spacing.xs,
    },
    setRow: {
        minHeight: 48,
        paddingVertical: Spacing.xs,
    },
    // A finished Workout has no inputs to hit, so its rows sit as tight as a table.
    readOnlyRow: {
        minHeight: 36,
    },
    subRow: {
        minHeight: 44,
        paddingVertical: Spacing.xs2,
    },
    columnLabel: {
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        textAlign: 'center',
    },
    // PREVIOUS reads left to right like its values.
    previousLabel: {
        alignItems: 'flex-start',
    },
    setCell: {
        width: 32,
        height: INPUT_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previousCell: {
        flex: 1.4,
        minWidth: 0,
        height: INPUT_HEIGHT,
        justifyContent: 'center',
    },
    inputCell: {
        flex: 1,
        minWidth: 0,
    },
    input: {
        height: INPUT_HEIGHT,
        borderRadius: Radius.sm,
        textAlign: 'center',
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        fontVariant: ['tabular-nums'],
        paddingVertical: 0,
        paddingHorizontal: Spacing.xs,
    },
    readOnlyValue: {
        textAlign: 'center',
    },
    checkCell: {
        width: 44,
    },
    check: {
        width: 44,
        height: INPUT_HEIGHT,
        borderRadius: Radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    subMarker: {
        transform: [{ rotate: '90deg' }],
    },
    removeSub: {
        width: 44,
        height: INPUT_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Lines "Add drop" up with the PREVIOUS column.
    addDropRow: {
        paddingLeft: 32 + CELL_GAP + Spacing.sm + Spacing.xs,
        alignItems: 'flex-start',
    },
    addDrop: {
        minHeight: 36,
        justifyContent: 'center',
    },
    addSetRow: {
        paddingHorizontal: Spacing.sm + Spacing.xs,
        paddingTop: Spacing.xs,
    },
    addSet: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        minHeight: 40,
        borderRadius: Radius.sm,
    },
})
