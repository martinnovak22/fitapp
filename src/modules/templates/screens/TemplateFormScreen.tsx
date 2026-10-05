import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontSize, FontWeight } from '@/src/constants/Typography'
import { useExerciseRepo, useWorkoutTemplateRepo } from '@/src/data/RepositoryContext'
import type { Exercise } from '@/src/db/exercises'
import { resolveMembers } from '@/src/db/templateMembership'
import { Button } from '@/src/modules/core/components/Button'
import { confirmDialog } from '@/src/modules/core/components/ConfirmDialog'
import { ListRow } from '@/src/modules/core/components/ListRow'
import { ListSection } from '@/src/modules/core/components/ListSection'
import { ScreenLayout, ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { log } from '@/src/modules/core/utils/logger'
import { showToast } from '@/src/modules/core/utils/toast'
import { ExercisePicker } from '@/src/modules/exercises/components/ExercisePicker'
import { exerciseSummaryLine } from '@/src/modules/exercises/taxonomyLabels'
import { TEMPLATE_NAME_MAX_LENGTH, validateTemplate } from '../templateForm'

const WORKOUT_TAB = '/(tabs)/workout' as const

const goBack = () => (router.canGoBack() ? router.back() : router.replace(WORKOUT_TAB))

// Create or edit a Workout Template: a name plus the Exercises a Planned
// Workout's picker will offer (ADR-0006). Edit mode when the route has an id.
export default function TemplateFormScreen() {
    const templateRepo = useWorkoutTemplateRepo()
    const exerciseRepo = useExerciseRepo()
    const { t } = useTranslation()
    const { theme } = useTheme()
    const navigation = useNavigation()
    const { id } = useLocalSearchParams<{ id?: string }>()
    const templateId = id ? Number(id) : undefined
    const isEditing = templateId !== undefined

    const [name, setName] = useState('')
    const [selected, setSelected] = useState<Set<string>>(() => new Set())
    const [exercises, setExercises] = useState<Exercise[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [nameError, setNameError] = useState('')
    const [exercisesError, setExercisesError] = useState('')
    const [pickerVisible, setPickerVisible] = useState(false)
    const nameInputRef = useRef<TextInput>(null)

    // Re-read on focus so an Exercise added from the empty state shows up on
    // return. The Template's own fields seed the form only once, so a refocus
    // never clobbers unsaved edits.
    const hasSeededRef = useRef(false)
    useFocusEffect(
        useCallback(() => {
            let cancelled = false
            const load = async () => {
                try {
                    const [allExercises, template] = await Promise.all([
                        exerciseRepo.getAll(),
                        templateId !== undefined && !hasSeededRef.current
                            ? templateRepo.getById(templateId)
                            : Promise.resolve(null),
                    ])
                    if (cancelled) return
                    if (templateId !== undefined && !hasSeededRef.current && !template) {
                        // Deleted elsewhere (another device, via sync) while this was open.
                        goBack()
                        return
                    }
                    setExercises(allExercises)
                    if (template) {
                        setName(template.name)
                        setSelected(new Set(template.exercise_uuids))
                    }
                    hasSeededRef.current = true
                } catch (error) {
                    log('error', 'Failed to load workout template', error)
                    if (!cancelled) showToast.danger({ title: t('error'), message: t('failedToLoadTemplate') })
                } finally {
                    if (!cancelled) setIsLoading(false)
                }
            }
            load()
            return () => {
                cancelled = true
            }
        }, [exerciseRepo, templateId, templateRepo, t])
    )

    const addExercises = useCallback((added: Exercise[]) => {
        setExercisesError('')
        setSelected((current) => {
            const next = new Set(current)
            for (const exercise of added) if (exercise.uuid) next.add(exercise.uuid)
            return next
        })
    }, [])

    const removeExercise = useCallback((uuid: string) => {
        setSelected((current) => {
            const next = new Set(current)
            next.delete(uuid)
            return next
        })
    }, [])

    // Members not on this device yet stay in `selected` (and are saved) but are
    // not counted: the badge shows what this device can actually offer.
    const members = useMemo(() => resolveMembers(selected, exercises), [selected, exercises])
    const selectedCount = members.length
    const candidates = useMemo(
        () => exercises.filter((exercise) => !(exercise.uuid && selected.has(exercise.uuid))),
        [exercises, selected]
    )

    const handleSave = useCallback(async () => {
        if (isSaving) return
        const result = validateTemplate({ name, exerciseUuids: [...selected], liveMemberCount: selectedCount })
        if (!result.ok) {
            if (result.field === 'name') {
                setNameError(t(result.errorKey))
                nameInputRef.current?.focus()
            } else {
                setExercisesError(t(result.errorKey))
            }
            return
        }

        setIsSaving(true)
        try {
            if (templateId !== undefined) {
                const written = await templateRepo.update(templateId, {
                    name: result.name,
                    exerciseUuids: result.exerciseUuids,
                })
                if (written === 0) {
                    // Deleted elsewhere while open; keep the form so the edits
                    // aren't silently lost behind a success toast.
                    showToast.danger({ title: t('error'), message: t('templateGoneWhileEditing') })
                    return
                }
            } else {
                await templateRepo.create({ name: result.name, exerciseUuids: result.exerciseUuids })
            }
            goBack()
        } catch (error) {
            log('error', 'Failed to save workout template', error)
            showToast.danger({ title: t('error'), message: t('failedToSaveTemplate') })
        } finally {
            setIsSaving(false)
        }
    }, [isSaving, name, selected, selectedCount, t, templateId, templateRepo])

    const handleDelete = useCallback(() => {
        if (templateId === undefined) return
        confirmDialog({
            title: t('deleteTemplateTitle'),
            message: t('deleteTemplateWarning', { name: name.trim() }),
            confirmLabel: t('delete'),
            destructive: true,
            onConfirm: async () => {
                try {
                    await templateRepo.delete(templateId)
                    goBack()
                } catch (error) {
                    log('error', 'Failed to delete workout template', error)
                    showToast.danger({ title: t('error'), message: t('failedToDeleteTemplate') })
                }
            },
        })
    }, [name, t, templateId, templateRepo])

    const canSave = !isLoading && !isSaving
    useFocusEffect(
        useCallback(() => {
            navigation.getParent()?.setOptions({
                headerTitle: t(isEditing ? 'editTemplate' : 'newTemplate'),
                headerLeft: () => (
                    <TouchableOpacity
                        onPress={goBack}
                        style={styles.headerBack}
                        accessibilityRole={'button'}
                        accessibilityLabel={t('back')}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                        <FontAwesome name={'chevron-left'} size={20} color={theme.text} />
                    </TouchableOpacity>
                ),
                headerRight: () => (
                    <Button
                        label={t('save')}
                        variant={'text'}
                        onPress={handleSave}
                        disabled={!canSave}
                        isLoading={isSaving}
                        style={styles.headerSave}
                    />
                ),
            })
        }, [canSave, handleSave, isEditing, isSaving, navigation, t, theme])
    )

    if (isLoading) {
        return (
            <ScreenLayout style={styles.centered}>
                <ActivityIndicator size={'large'} color={theme.primary} />
            </ScreenLayout>
        )
    }

    return (
        <ScrollScreenLayout keyboardShouldPersistTaps={'handled'} contentContainerStyle={styles.content}>
            <View style={styles.form}>
                <View style={styles.field}>
                    <TextInput
                        ref={nameInputRef}
                        value={name}
                        onChangeText={(value) => {
                            setName(value)
                            if (nameError) setNameError('')
                        }}
                        placeholder={t('templateNamePlaceholder')}
                        placeholderTextColor={theme.textSecondary}
                        maxLength={TEMPLATE_NAME_MAX_LENGTH}
                        autoFocus={!isEditing}
                        returnKeyType={'done'}
                        selectionColor={theme.primary}
                        style={[
                            styles.nameInput,
                            {
                                color: theme.text,
                                backgroundColor: theme.inputBackground,
                                borderColor: nameError ? theme.error : 'transparent',
                            },
                        ]}
                        accessibilityLabel={t('templateName')}
                        accessibilityHint={t('required')}
                    />
                    {nameError ? <Typography.Meta color={'error'}>{nameError}</Typography.Meta> : null}
                </View>

                {exercises.length === 0 ? (
                    <ListSection title={t('templateExercises')} footer={t('templateNeedsExercisesFirst')}>
                        {/* Switch to the Exercises tab rather than pushing its add
                            form into this stack: a cross-tab push leaves the form
                            behind in the Exercises stack after save. */}
                        <ListRow
                            label={t('goToExercises')}
                            leadingIcon={'list'}
                            accessory={'chevron'}
                            onPress={() => router.navigate('/(tabs)/exercises')}
                        />
                    </ListSection>
                ) : (
                    <View style={styles.field}>
                        <ListSection
                            title={t('exercisesCount', { count: selectedCount })}
                            footer={exercisesError ? undefined : t('templateExercisesHint')}
                        >
                            {members.map((exercise) => (
                                <ListRow
                                    key={exercise.uuid}
                                    label={exercise.name}
                                    subtitle={exerciseSummaryLine(t, exercise)}
                                    trailing={
                                        <TouchableOpacity
                                            onPress={() => exercise.uuid && removeExercise(exercise.uuid)}
                                            style={styles.removeButton}
                                            accessibilityRole={'button'}
                                            accessibilityLabel={t('removeFromPlan', { name: exercise.name })}
                                        >
                                            <FontAwesome name={'times'} size={16} color={theme.textSecondary} />
                                        </TouchableOpacity>
                                    }
                                />
                            ))}
                            <ListRow
                                label={t('addExercises')}
                                leadingIcon={'plus'}
                                onPress={() => setPickerVisible(true)}
                                disabled={candidates.length === 0}
                            />
                        </ListSection>
                        {exercisesError ? (
                            <Typography.Meta color={'error'} style={styles.inset}>
                                {exercisesError}
                            </Typography.Meta>
                        ) : null}
                    </View>
                )}

                {isEditing && (
                    <ListSection>
                        <ListRow label={t('deletePlan')} leadingIcon={'trash'} destructive onPress={handleDelete} />
                    </ListSection>
                )}
            </View>

            <ExercisePicker
                visible={pickerVisible}
                onClose={() => setPickerVisible(false)}
                title={t('addExercises')}
                exercises={candidates}
                onAdd={addExercises}
            />
        </ScrollScreenLayout>
    )
}

const styles = StyleSheet.create({
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        paddingBottom: Spacing.xxl,
    },
    form: {
        gap: Spacing.lg,
    },
    field: {
        gap: Spacing.sm,
    },
    nameInput: {
        minHeight: 56,
        borderRadius: Radius.sm,
        borderWidth: 1,
        paddingHorizontal: Spacing.md,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
    },
    inset: {
        paddingHorizontal: Spacing.md,
    },
    removeButton: {
        width: 44,
        height: 44,
        marginRight: -Spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerBack: {
        paddingLeft: Spacing.md,
        paddingRight: Spacing.sm,
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
    },
    headerSave: {
        minHeight: 44,
        paddingHorizontal: Spacing.md,
    },
})
