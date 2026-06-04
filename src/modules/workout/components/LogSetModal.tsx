import FontAwesome from '@expo/vector-icons/FontAwesome'
import React from 'react'
import { useTranslation } from 'react-i18next'
import {
    Dimensions,
    Keyboard,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Duration, Motion } from '@/src/constants/Motion'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { GlobalStyles } from '@/src/constants/Styles'
import { FontSize, FontWeight } from '@/src/constants/Typography'
import type { Exercise } from '@/src/db/exercises'
import type { SubSet } from '@/src/db/workouts'
import { Button } from '@/src/modules/core/components/Button'
import { Collapsible } from '@/src/modules/core/components/motion'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { ExercisePicker } from '@/src/modules/exercises/ExercisePicker'
import type { SetFormValues } from '../setPayload'
import { parseSetInputNumber, reconcileSubSetKeys } from './dropSet'
import { resolveSetInputLayout, type SetInputField, type SetInputLayout } from './setInputLayout'

const { height: DEVICE_HEIGHT } = Dimensions.get('window')
const SHEET_MAX_HEIGHT = Math.min(DEVICE_HEIGHT * 0.9, 760)
// Fixed height for the pyramid list so adding rows scrolls inside it rather than
// growing the section. The list still carries flexShrink, and the Collapsible
// content now shrinks too, so a space-constrained sheet gives the list less
// height instead of overflowing.
const PYRAMID_LIST_HEIGHT = Math.min(200, Math.floor(DEVICE_HEIGHT * 0.22))
// Shared so every toggled block fades and reflows on the same timeline.
const ENTER = Motion.fadeIn()
const EXIT = Motion.fadeOut()
const UNIFIED_LAYOUT = Motion.layout()
const KEYBOARD_LIFT_FACTOR = 0.9
// Distance (px) the sheet slides down on entry/exit. Entry starts here and
// settles to 0; exit reverses, dropping the sheet back down as it fades.
const SHEET_SLIDE_OFFSET = 32

type Props = {
    visible: boolean
    onClose: () => void
    onSave: () => void
    editingSetId: number | null
    exercises: Exercise[]
    selectedExerciseId: number | null
    setSelectedExerciseId: (id: number) => void
    subSets: SubSet[]
    setSubSets: React.Dispatch<React.SetStateAction<SubSet[]>>
    inputValues: SetFormValues
    updateInput: (key: keyof SetFormValues, value: string) => void
    isSaving: boolean
}

export const LogSetModal = ({
    visible,
    onClose,
    onSave,
    editingSetId,
    exercises,
    selectedExerciseId,
    setSelectedExerciseId,
    subSets,
    setSubSets,
    inputValues,
    updateInput,
    isSaving,
}: Props) => {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const insets = useSafeAreaInsets()

    const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId)
    const [isExpanded, setIsExpanded] = React.useState(false)
    const [isMounted, setIsMounted] = React.useState(visible)
    const wasVisibleRef = React.useRef(false)

    const keyboardInset = useSharedValue(0)
    const sheetOpacity = useSharedValue(0)
    const sheetOffset = useSharedValue(SHEET_SLIDE_OFFSET)
    const backdropOpacity = useSharedValue(0)

    const handleCloseComplete = React.useCallback(() => {
        setIsMounted(false)
        setIsExpanded(false)
        // Reset for the next open so the entry starts from its slid-down state.
        keyboardInset.value = 0
        sheetOffset.value = SHEET_SLIDE_OFFSET
    }, [keyboardInset, sheetOffset])

    React.useEffect(() => {
        if (visible) {
            // Open: ensure mounted, then run the entry. Guard with wasVisibleRef
            // so re-renders while open don't restart the entry animation.
            setIsMounted(true)
            if (!wasVisibleRef.current) {
                wasVisibleRef.current = true
                sheetOpacity.value = 0
                sheetOffset.value = SHEET_SLIDE_OFFSET
                backdropOpacity.value = 0
                sheetOpacity.value = withTiming(1, { duration: Duration.fast })
                sheetOffset.value = withTiming(0, { duration: Duration.base })
                backdropOpacity.value = withTiming(1, { duration: Duration.base })
            }
            return
        }
        // Close: only animate out if we were actually open. Slide down + fade
        // both the sheet and backdrop, then unmount via runOnJS on completion.
        if (wasVisibleRef.current) {
            wasVisibleRef.current = false
            backdropOpacity.value = withTiming(0, { duration: Duration.base })
            sheetOpacity.value = withTiming(0, { duration: Duration.base })
            sheetOffset.value = withTiming(SHEET_SLIDE_OFFSET, { duration: Duration.base }, (finished) => {
                if (finished) runOnJS(handleCloseComplete)()
            })
        }
    }, [backdropOpacity, handleCloseComplete, sheetOffset, sheetOpacity, visible])

    // Auto-expand the pyramid section when the modal opens with existing sub-sets
    // (e.g. editing a set). Keyed only on `visible` so it fires on open — not on
    // every row add/remove, which would otherwise re-run the animation effect.
    React.useEffect(() => {
        if (visible && subSets.length > 0) setIsExpanded(true)
    }, [visible, subSets.length])

    React.useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

        const showSub = Keyboard.addListener(showEvent, (event) => {
            const keyboardHeight = Math.max(0, event.endCoordinates.height)
            const platformOffset = Platform.OS === 'ios' ? 10 : 24
            const baseInset = Math.max(0, keyboardHeight - platformOffset)
            const duration = event.duration > 0 ? event.duration : Platform.OS === 'ios' ? 220 : 120
            keyboardInset.value = withTiming(baseInset * KEYBOARD_LIFT_FACTOR, { duration })
        })
        const hideSub = Keyboard.addListener(hideEvent, (event) => {
            const duration = event.duration > 0 ? event.duration : Platform.OS === 'ios' ? 220 : 120
            keyboardInset.value = withTiming(0, { duration })
        })

        return () => {
            showSub.remove()
            hideSub.remove()
        }
    }, [keyboardInset])

    const sheetStyle = useAnimatedStyle(() => ({
        opacity: sheetOpacity.value,
        transform: [{ translateY: sheetOffset.value - keyboardInset.value }],
    }))

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }))

    // Stable identity-based keys for sub-set rows. Keys live alongside `subSets`
    // (which is owned by the parent) so that adding/removing in the middle of the
    // list does not move TextInput focus to a neighbouring row.
    const keyCounter = React.useRef(0)
    const generateKey = React.useCallback(() => {
        keyCounter.current += 1
        return `subset-${keyCounter.current}`
    }, [])
    const [subSetKeys, setSubSetKeys] = React.useState<string[]>(() => subSets.map(() => generateKey()))

    // Resync keys when the externally-owned `subSets` length changes from outside
    // (modal opened for edit, reset on save). Internal add/remove keep keys in
    // step with subSets eagerly, so we only need to top-up / truncate here.
    React.useEffect(() => {
        setSubSetKeys((prev) => reconcileSubSetKeys(prev, subSets.length, generateKey))
    }, [subSets.length, generateKey])

    const addSubSet = React.useCallback(() => {
        const newKey = generateKey()
        setSubSetKeys((prev) => [...prev, newKey])
        setSubSets((prev) => [...prev, { weight: 0, reps: 0 }])
        setIsExpanded(true)
    }, [generateKey, setSubSets])

    const updateSubSet = React.useCallback(
        (index: number, field: keyof SubSet, value: string) => {
            const num = parseSetInputNumber(value)
            setSubSets((prev) => {
                const next = [...prev]
                next[index] = { ...next[index], [field]: num }
                return next
            })
        },
        [setSubSets]
    )

    const removeSubSet = React.useCallback(
        (index: number) => {
            setSubSetKeys((prev) => prev.filter((_, i) => i !== index))
            setSubSets((prev) => prev.filter((_, i) => i !== index))
        },
        [setSubSets]
    )

    const subSetItems = React.useMemo(
        () => subSets.map((subSet, idx) => ({ key: subSetKeys[idx] ?? `subset-fallback-${idx}`, subSet, index: idx })),
        [subSets, subSetKeys]
    )

    return (
        <Modal animationType={'none'} transparent visible={isMounted} onRequestClose={onClose}>
            <View style={styles.modalRoot}>
                <Animated.View style={[styles.backdrop, { backgroundColor: theme.overlayBackdrop }, backdropStyle]}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                </Animated.View>

                <Animated.View
                    layout={UNIFIED_LAYOUT}
                    style={[styles.sheet, { backgroundColor: theme.surface }, sheetStyle]}
                >
                    <View style={styles.grabberWrap}>
                        <View style={[styles.grabber, { backgroundColor: `${theme.textSecondary}66` }]} />
                    </View>

                    <Typography.Title>{editingSetId ? t('editSet') : t('inputSet')}</Typography.Title>

                    <View style={styles.body}>
                        {!editingSetId && (
                            <Animated.View entering={ENTER}>
                                <ExercisePicker
                                    exercises={exercises}
                                    selectedId={selectedExerciseId}
                                    onPick={(exercise) => {
                                        setSelectedExerciseId(exercise.id)
                                        const fields = [
                                            'weight',
                                            'reps',
                                            'distance',
                                            'durationMinutes',
                                            'durationSeconds',
                                        ] as const
                                        for (const key of fields) updateInput(key, '')
                                    }}
                                />
                            </Animated.View>
                        )}

                        {selectedExercise && (
                            <View style={styles.scrollBody}>
                                <SetInputFields
                                    selectedExercise={selectedExercise}
                                    inputValues={inputValues}
                                    updateInput={updateInput}
                                />

                                {selectedExercise.type === 'weight' && (
                                    <Animated.View
                                        entering={ENTER}
                                        exiting={EXIT}
                                        style={[styles.pyramidSection, { borderTopColor: theme.inputBackground }]}
                                    >
                                        <View style={styles.pyramidHeader}>
                                            <TouchableOpacity
                                                onPress={() => setIsExpanded(!isExpanded)}
                                                style={styles.pyramidTitleContainer}
                                                activeOpacity={0.7}
                                            >
                                                <Typography.Meta weight="heavy" style={styles.pyramidTitle}>
                                                    {t('pyramidSet')} {subSets.length > 0 ? `(${subSets.length})` : ''}
                                                </Typography.Meta>
                                                <FontAwesome
                                                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                                    size={10}
                                                    color={theme.textSecondary}
                                                    style={styles.pyramidChevron}
                                                />
                                            </TouchableOpacity>

                                            <Button
                                                leftIcon={'plus'}
                                                onPress={addSubSet}
                                                variant={'primary'}
                                                size={'sm'}
                                                accessibilityLabel={t('addDropSet')}
                                            />
                                        </View>

                                        <Collapsible expanded={isExpanded} style={styles.pyramidListWrap}>
                                            <DropSetList
                                                items={subSetItems}
                                                theme={theme}
                                                t={t}
                                                onChange={updateSubSet}
                                                onRemove={removeSubSet}
                                            />
                                        </Collapsible>
                                    </Animated.View>
                                )}
                            </View>
                        )}
                    </View>

                    <View
                        style={[
                            styles.footerSurface,
                            {
                                backgroundColor: theme.surface,
                                borderTopColor: `${theme.border}33`,
                                paddingBottom: Spacing.sm + insets.bottom,
                            },
                        ]}
                    >
                        <View style={styles.footer}>
                            <Button label={t('cancel')} variant={'secondary'} size={'sm'} onPress={onClose} />
                            <Button
                                label={editingSetId ? t('update') : t('addSet')}
                                size={'sm'}
                                onPress={onSave}
                                isLoading={isSaving}
                                disabled={!selectedExerciseId || isSaving}
                            />
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    )
}

type SubSetRowProps = {
    index: number
    subSet: SubSet
    theme: ReturnType<typeof useTheme>['theme']
    t: ReturnType<typeof useTranslation>['t']
    onChange: (index: number, field: keyof SubSet, value: string) => void
    onRemove: (index: number) => void
}

const SubSetRow = React.memo(function SubSetRow({ index, subSet, theme, t, onChange, onRemove }: SubSetRowProps) {
    const handleWeightChange = React.useCallback((value: string) => onChange(index, 'weight', value), [index, onChange])
    const handleRepsChange = React.useCallback((value: string) => onChange(index, 'reps', value), [index, onChange])
    const handleRemove = React.useCallback(() => onRemove(index), [index, onRemove])

    return (
        <View style={[styles.subSetRow, { borderBottomColor: theme.inputBackground }]}>
            <View style={styles.subSetIndexContainer}>
                <Typography.Meta weight="bold" style={styles.subSetIndex}>
                    #{index + 1}
                </Typography.Meta>
            </View>

            <View style={styles.subSetInputGroup}>
                <TextInput
                    style={[styles.subSetInput, { color: theme.text, backgroundColor: theme.inputBackground }]}
                    keyboardType={'numeric'}
                    multiline={false}
                    numberOfLines={1}
                    placeholder={t('weight').toLowerCase()}
                    placeholderTextColor={theme.textSecondary}
                    defaultValue={subSet.weight && subSet.weight > 0 ? subSet.weight.toString() : ''}
                    onChangeText={handleWeightChange}
                    underlineColorAndroid={'transparent'}
                    selectionColor={theme.primary}
                    scrollEnabled={false}
                    returnKeyType={'next'}
                    accessibilityLabel={`${t('drop')} ${index + 1} ${t('weight')}`}
                />
                <Typography.Meta style={styles.subSetX}>×</Typography.Meta>
                <TextInput
                    style={[styles.subSetInput, { color: theme.text, backgroundColor: theme.inputBackground }]}
                    keyboardType={'numeric'}
                    multiline={false}
                    numberOfLines={1}
                    placeholder={t('reps').toLowerCase()}
                    placeholderTextColor={theme.textSecondary}
                    defaultValue={subSet.reps && subSet.reps > 0 ? subSet.reps.toString() : ''}
                    onChangeText={handleRepsChange}
                    underlineColorAndroid={'transparent'}
                    selectionColor={theme.primary}
                    scrollEnabled={false}
                    returnKeyType={'done'}
                    accessibilityLabel={`${t('drop')} ${index + 1} ${t('reps')}`}
                />
            </View>

            <Button
                leftIcon={'minus-circle'}
                onPress={handleRemove}
                variant={'text'}
                size={'sm'}
                accessibilityLabel={t('delete')}
                labelStyle={{ color: theme.error }}
            />
        </View>
    )
})

type SubSetItem = { key: string; subSet: SubSet; index: number }

type DropSetListProps = {
    items: SubSetItem[]
    theme: SubSetRowProps['theme']
    t: SubSetRowProps['t']
    onChange: SubSetRowProps['onChange']
    onRemove: SubSetRowProps['onRemove']
}

// The scrollable drop-set list: an empty-state placeholder or one SubSetRow per
// item. Sits inside the Collapsible so expand/collapse stays in LogSetModal.
const DropSetList = ({ items, theme, t, onChange, onRemove }: DropSetListProps) => (
    <ScrollView
        style={[styles.pyramidList, { backgroundColor: theme.background }]}
        contentContainerStyle={items.length === 0 ? styles.emptySubsetsContainer : undefined}
        nestedScrollEnabled
        keyboardShouldPersistTaps={'handled'}
        showsVerticalScrollIndicator
    >
        {items.length === 0 ? (
            <>
                <FontAwesome name={'list'} size={20} color={theme.textSecondary} style={styles.emptySubsetsIcon} />
                <Typography.Meta weight="semibold" style={styles.emptySubsetsText}>
                    {t('noDropSets')}
                </Typography.Meta>
            </>
        ) : (
            items.map((item) => (
                <SubSetRow
                    key={item.key}
                    index={item.index}
                    subSet={item.subSet}
                    theme={theme}
                    t={t}
                    onChange={onChange}
                    onRemove={onRemove}
                />
            ))
        )}
    </ScrollView>
)

type SetFieldInputProps = {
    field: SetInputField
    value: string
    onChange: Props['updateInput']
    theme: SubSetRowProps['theme']
    t: SubSetRowProps['t']
}

// Label + numeric input shared by every set field. The only per-field variation
// (binding, placeholder, return key, label) rides in on the layout descriptor,
// so there is exactly one TextInput configuration to maintain.
const SetFieldInput = ({ field, value, onChange, theme, t }: SetFieldInputProps) => (
    <>
        <Typography.Subtitle>{t(field.labelKey)}</Typography.Subtitle>
        <TextInput
            keyboardType={'numeric'}
            multiline={false}
            numberOfLines={1}
            style={[
                GlobalStyles.input,
                { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.border },
            ]}
            value={value}
            onChangeText={(text) => onChange(field.key, text)}
            placeholder={field.placeholder}
            placeholderTextColor={theme.textSecondary}
            underlineColorAndroid={'transparent'}
            selectionColor={theme.primary}
            scrollEnabled={false}
            returnKeyType={field.returnKey}
            accessibilityLabel={t(field.labelKey)}
        />
    </>
)

type DurationRowProps = {
    duration: NonNullable<SetInputLayout['duration']>
    inputValues: Props['inputValues']
    updateInput: Props['updateInput']
    theme: SubSetRowProps['theme']
    t: SubSetRowProps['t']
}

const DurationRow = ({ duration, inputValues, updateInput, theme, t }: DurationRowProps) => (
    <Animated.View entering={ENTER} exiting={EXIT} style={[styles.durationRow, { minWidth: duration.minWidth }]}>
        {duration.fields.map((field) => (
            <View key={field.key} style={styles.durationCell}>
                <SetFieldInput
                    field={field}
                    value={inputValues[field.key]}
                    onChange={updateInput}
                    theme={theme}
                    t={t}
                />
            </View>
        ))}
    </Animated.View>
)

const SetInputFields = React.memo(function SetInputFields({
    selectedExercise,
    inputValues,
    updateInput,
}: {
    selectedExercise?: Exercise
    inputValues: Props['inputValues']
    updateInput: Props['updateInput']
}) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const layout = resolveSetInputLayout(selectedExercise?.type?.toLowerCase())

    return (
        <View style={styles.dynamicFields}>
            {layout.fields.map((field) => (
                <Animated.View
                    key={field.key}
                    entering={ENTER}
                    exiting={EXIT}
                    style={[styles.fieldCell, { minWidth: field.minWidth }]}
                >
                    <SetFieldInput
                        field={field}
                        value={inputValues[field.key]}
                        onChange={updateInput}
                        theme={theme}
                        t={t}
                    />
                </Animated.View>
            ))}

            {layout.duration && (
                <DurationRow
                    duration={layout.duration}
                    inputValues={inputValues}
                    updateInput={updateInput}
                    theme={theme}
                    t={t}
                />
            )}
        </View>
    )
})

const styles = StyleSheet.create({
    modalRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    sheet: {
        width: '100%',
        maxHeight: SHEET_MAX_HEIGHT,
        borderTopLeftRadius: Radius.lg,
        borderTopRightRadius: Radius.lg,
        overflow: 'hidden',
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        paddingBottom: 0,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
    },
    grabberWrap: {
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    grabber: {
        width: 42,
        height: 4,
        borderRadius: Radius.pill,
    },
    body: {
        flexShrink: 1,
        minHeight: 0,
    },
    scrollBody: {
        flexShrink: 1,
        minHeight: 0,
        marginTop: Spacing.sm,
    },
    dynamicFields: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    fieldCell: {
        flex: 1,
        gap: Spacing.sm,
    },
    durationRow: {
        flex: 2,
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    durationCell: {
        flex: 1,
        gap: Spacing.sm,
    },
    pyramidSection: {
        flexShrink: 1,
        minHeight: 0,
        paddingVertical: Spacing.sm,
        borderTopWidth: 1,
    },
    pyramidHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pyramidTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.xs,
    },
    pyramidTitle: {
        textTransform: 'uppercase',
    },
    pyramidChevron: {
        marginLeft: Spacing.xs,
        opacity: 0.5,
    },
    pyramidListWrap: {
        flexShrink: 1,
        minHeight: 0,
        overflow: 'hidden',
        marginTop: Spacing.sm,
    },
    pyramidList: {
        height: PYRAMID_LIST_HEIGHT,
        minHeight: 120,
        flexShrink: 1,
        borderRadius: Radius.sm,
    },
    emptySubsetsContainer: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.lg,
    },
    emptySubsetsIcon: {
        opacity: 0.2,
        marginBottom: 8,
    },
    emptySubsetsText: {
        opacity: 0.5,
    },
    subSetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderBottomWidth: 1,
        gap: Spacing.sm,
    },
    subSetIndexContainer: {
        width: 24,
    },
    subSetIndex: {
        opacity: 0.6,
    },
    subSetInputGroup: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    subSetInput: {
        flex: 1,
        height: 34,
        borderRadius: Radius.sm,
        textAlign: 'center',
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        paddingVertical: 0,
        includeFontPadding: false,
    },
    subSetX: {
        opacity: 0.4,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
    },
    footerSurface: {
        borderTopWidth: 1,
        paddingTop: Spacing.xs,
        zIndex: 2,
    },
})
