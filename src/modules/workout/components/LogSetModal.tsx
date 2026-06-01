import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { GlobalStyles } from '@/src/constants/Styles'
import { FontSize, FontWeight } from '@/src/constants/Typography'
import { Exercise } from '@/src/db/exercises'
import { SubSet } from '@/src/db/workouts'
import { Button } from '@/src/modules/core/components/Button'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { ExercisePicker } from '@/src/modules/exercises/ExercisePicker'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import React from 'react'
import { useTranslation } from 'react-i18next'
import {
    Dimensions,
    FlatList,
    Keyboard,
    type ListRenderItem,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native'
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { SetFormValues } from '../setPayload'

const { height: DEVICE_HEIGHT } = Dimensions.get('window')
const SHEET_MAX_HEIGHT = Math.min(DEVICE_HEIGHT * 0.9, 760)
const PYRAMID_LIST_HEIGHT = Math.min(200, Math.floor(DEVICE_HEIGHT * 0.22))
const UNIFIED_LAYOUT = LinearTransition.duration(200)
const KEYBOARD_LIFT_FACTOR = 0.8

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

    const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId)
    const [isExpanded, setIsExpanded] = React.useState(false)
    const wasVisibleRef = React.useRef(false)

    const keyboardInset = useSharedValue(0)
    const sheetOpacity = useSharedValue(0)
    const sheetOffset = useSharedValue(32)

    React.useEffect(() => {
        if (!visible) {
            sheetOpacity.value = 0
            sheetOffset.value = 0
            keyboardInset.value = 0
            setIsExpanded(false)
            wasVisibleRef.current = false
            return
        }
        if (!wasVisibleRef.current) {
            wasVisibleRef.current = true
            sheetOpacity.value = 0
            sheetOffset.value = 32
            sheetOpacity.value = withTiming(1, { duration: 180 })
            sheetOffset.value = withTiming(0, { duration: 220 })
            if (subSets.length > 0) setIsExpanded(true)
        }
    }, [keyboardInset, sheetOffset, sheetOpacity, subSets.length, visible])

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
        setSubSetKeys((prev) => {
            if (prev.length === subSets.length) return prev
            if (prev.length < subSets.length) {
                const next = prev.slice()
                while (next.length < subSets.length) next.push(generateKey())
                return next
            }
            return prev.slice(0, subSets.length)
        })
    }, [subSets.length, generateKey])

    const addSubSet = React.useCallback(() => {
        const newKey = generateKey()
        setSubSetKeys((prev) => [...prev, newKey])
        setSubSets((prev) => [...prev, { weight: 0, reps: 0 }])
        setIsExpanded(true)
    }, [generateKey, setSubSets])

    const updateSubSet = React.useCallback(
        (index: number, field: keyof SubSet, value: string) => {
            const num = parseFloat(value.replace(',', '.')) || 0
            setSubSets((prev) => {
                const next = [...prev]
                next[index] = { ...next[index], [field]: num }
                return next
            })
        },
        [setSubSets],
    )

    const removeSubSet = React.useCallback(
        (index: number) => {
            setSubSetKeys((prev) => prev.filter((_, i) => i !== index))
            setSubSets((prev) => prev.filter((_, i) => i !== index))
        },
        [setSubSets],
    )

    const subSetItems = React.useMemo(
        () => subSets.map((subSet, idx) => ({ key: subSetKeys[idx] ?? `subset-fallback-${idx}`, subSet, index: idx })),
        [subSets, subSetKeys],
    )

    const renderSubSetRow: ListRenderItem<{ key: string; subSet: SubSet; index: number }> = React.useCallback(
        ({ item }) => (
            <SubSetRow
                index={item.index}
                subSet={item.subSet}
                theme={theme}
                t={t}
                onChange={updateSubSet}
                onRemove={removeSubSet}
            />
        ),
        [theme, t, updateSubSet, removeSubSet],
    )

    return (
        <Modal animationType={'none'} transparent visible={visible} onRequestClose={onClose}>
            <View style={styles.modalRoot}>
                <Animated.View entering={FadeIn.duration(180)} style={[styles.backdrop, { backgroundColor: theme.overlayBackdrop }]}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                </Animated.View>

                <Animated.View style={[styles.sheet, { backgroundColor: theme.surface }, sheetStyle]}>
                    <View style={styles.grabberWrap}>
                        <View style={[styles.grabber, { backgroundColor: `${theme.textSecondary}66` }]} />
                    </View>

                    <Typography.Title>{editingSetId ? t('editSet') : t('inputSet')}</Typography.Title>

                        <Animated.View layout={UNIFIED_LAYOUT}>
                            {!editingSetId && (
                                <Animated.View entering={FadeIn.duration(160)}>
                                    <ExercisePicker
                                        exercises={exercises}
                                        onPick={(exercise) => {
                                            setSelectedExerciseId(exercise.id)
                                            const fields = ['weight', 'reps', 'distance', 'durationMinutes', 'durationSeconds'] as const
                                            fields.forEach((key) => updateInput(key, ''))
                                        }}
                                    />
                                </Animated.View>
                            )}

                            {selectedExercise && (
                                <Animated.View
                                    entering={FadeIn.duration(180)}
                                    style={styles.inputsSection}
                                >
                                    <SetInputFields
                                        selectedExercise={selectedExercise}
                                        inputValues={inputValues}
                                        updateInput={updateInput}
                                    />

                                    {selectedExercise.type === 'weight' && (
                                        <Animated.View
                                            entering={FadeIn.duration(200)}
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

                                                <TouchableOpacity
                                                    style={[styles.addDropButton, { backgroundColor: theme.primary }]}
                                                    onPress={addSubSet}
                                                >
                                                    <FontAwesome name={'plus'} size={10} color={theme.onPrimary} />
                                                </TouchableOpacity>
                                            </View>

                                            {isExpanded && (
                                                <Animated.View
                                                    entering={FadeIn.duration(160)}
                                                    style={styles.pyramidListWrap}
                                                >
                                                    <FlatList
                                                        data={subSetItems}
                                                        keyExtractor={(item) => item.key}
                                                        renderItem={renderSubSetRow}
                                                        style={[styles.pyramidList, { backgroundColor: theme.background }]}
                                                        contentContainerStyle={subSetItems.length === 0 ? styles.emptySubsetsContainer : undefined}
                                                        keyboardShouldPersistTaps={'handled'}
                                                        showsVerticalScrollIndicator
                                                        removeClippedSubviews={false}
                                                        ListEmptyComponent={(
                                                            <View style={styles.emptySubsets}>
                                                                <FontAwesome
                                                                    name={'list'}
                                                                    size={20}
                                                                    color={theme.textSecondary}
                                                                    style={styles.emptySubsetsIcon}
                                                                />
                                                                <Typography.Meta weight="semibold" style={styles.emptySubsetsText}>{t('noDropSets')}</Typography.Meta>
                                                            </View>
                                                        )}
                                                    />
                                                </Animated.View>
                                            )}
                                        </Animated.View>
                                    )}
                                </Animated.View>
                            )}
                        </Animated.View>

                    <View
                        style={[
                            styles.footerSurface,
                            {
                                backgroundColor: theme.surface,
                                borderTopColor: `${theme.border}33`,
                                paddingBottom: Spacing.sm
                            },
                        ]}
                    >
                        <View style={styles.footer}>
                            <Button label={t('cancel')} variant={'outline'} onPress={onClose} />
                            <Button
                                label={editingSetId ? t('update') : t('addSet')}
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
                accessibilityLabel={t('delete')}
                labelStyle={{ color: theme.error }}
            />
        </View>
    )
})

const SetInputFields = ({ selectedExercise, inputValues, updateInput }: { selectedExercise?: Exercise; inputValues: Props['inputValues']; updateInput: Props['updateInput'] }) => {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const type = selectedExercise?.type?.toLowerCase()

    return (
        <View style={styles.dynamicFields}>
            {type !== 'cardio' && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    layout={UNIFIED_LAYOUT}
                    style={[styles.fieldCell, { minWidth: type === 'bodyweight_timer' ? '100%' : '46%' }]}
                >
                    <Typography.Subtitle>{t('weightKg')}</Typography.Subtitle>
                    <TextInput
                        keyboardType={'numeric'}
                        multiline={false}
                        numberOfLines={1}
                        style={[GlobalStyles.input, { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.border }]}
                        value={inputValues.weight}
                        onChangeText={(value) => updateInput('weight', value)}
                        placeholder={'0'}
                        placeholderTextColor={theme.textSecondary}
                        underlineColorAndroid={'transparent'}
                        selectionColor={theme.primary}
                        scrollEnabled={false}
                        returnKeyType={'next'}
                        accessibilityLabel={t('weightKg')}
                    />
                </Animated.View>
            )}

            {(type === 'weight' || type === 'bodyweight') && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    layout={UNIFIED_LAYOUT}
                    style={[styles.fieldCell, { minWidth: '46%' }]}
                >
                    <Typography.Subtitle>{t('reps')}</Typography.Subtitle>
                    <TextInput
                        keyboardType={'numeric'}
                        multiline={false}
                        numberOfLines={1}
                        style={[GlobalStyles.input, { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.border }]}
                        value={inputValues.reps}
                        onChangeText={(value) => updateInput('reps', value)}
                        placeholder={'0'}
                        placeholderTextColor={theme.textSecondary}
                        underlineColorAndroid={'transparent'}
                        selectionColor={theme.primary}
                        scrollEnabled={false}
                        returnKeyType={'done'}
                        accessibilityLabel={t('reps')}
                    />
                </Animated.View>
            )}

            {type === 'cardio' && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    layout={UNIFIED_LAYOUT}
                    style={[styles.fieldCell, styles.fieldFull]}
                >
                    <Typography.Subtitle>{t('distM')}</Typography.Subtitle>
                    <TextInput
                        keyboardType={'numeric'}
                        multiline={false}
                        numberOfLines={1}
                        style={[GlobalStyles.input, { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.border }]}
                        value={inputValues.distance}
                        onChangeText={(value) => updateInput('distance', value)}
                        placeholder={'0'}
                        placeholderTextColor={theme.textSecondary}
                        underlineColorAndroid={'transparent'}
                        selectionColor={theme.primary}
                        scrollEnabled={false}
                        returnKeyType={'next'}
                        accessibilityLabel={t('distM')}
                    />
                </Animated.View>
            )}

            {(type === 'cardio' || type === 'bodyweight_timer') && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    layout={UNIFIED_LAYOUT}
                    style={[styles.durationRow, { minWidth: type === 'cardio' ? '65%' : '100%' }]}
                >
                    <View style={styles.durationCell}>
                        <Typography.Subtitle>{t('minutes')}</Typography.Subtitle>
                        <TextInput
                            keyboardType={'numeric'}
                            multiline={false}
                            numberOfLines={1}
                            style={[GlobalStyles.input, { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.border }]}
                            value={inputValues.durationMinutes}
                            onChangeText={(value) => updateInput('durationMinutes', value)}
                            placeholder={'00'}
                            placeholderTextColor={theme.textSecondary}
                            underlineColorAndroid={'transparent'}
                            selectionColor={theme.primary}
                            scrollEnabled={false}
                            returnKeyType={'next'}
                            accessibilityLabel={t('minutes')}
                        />
                    </View>
                    <View style={styles.durationCell}>
                        <Typography.Subtitle>{t('seconds')}</Typography.Subtitle>
                        <TextInput
                            keyboardType={'numeric'}
                            multiline={false}
                            numberOfLines={1}
                            style={[GlobalStyles.input, { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.border }]}
                            value={inputValues.durationSeconds}
                            onChangeText={(value) => updateInput('durationSeconds', value)}
                            placeholder={'00'}
                            placeholderTextColor={theme.textSecondary}
                            underlineColorAndroid={'transparent'}
                            selectionColor={theme.primary}
                            scrollEnabled={false}
                            returnKeyType={'done'}
                            accessibilityLabel={t('seconds')}
                        />
                    </View>
                </Animated.View>
            )}
        </View>
    )
}

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
    inputsSection: {
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
    fieldFull: {
        minWidth: '100%',
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
    addDropButton: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.sm,
    },
    pyramidListWrap: {
        overflow: 'hidden',
        marginTop: Spacing.sm,
    },
    pyramidList: {
        height: PYRAMID_LIST_HEIGHT,
        borderRadius: Radius.sm,
    },
    emptySubsetsContainer: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptySubsets: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.lg,
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
        paddingVertical: Spacing.md,
    },
    footerSurface: {
        borderTopWidth: 1,
        paddingTop: Spacing.xs,
        zIndex: 2,
    },
})
