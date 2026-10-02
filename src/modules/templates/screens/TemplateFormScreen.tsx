import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { GlobalStyles } from '@/src/constants/Styles'
import { useExerciseRepo, useWorkoutTemplateRepo } from '@/src/data/RepositoryContext'
import type { Exercise } from '@/src/db/exercises'
import { resolveMembers } from '@/src/db/templateMembership'
import { Button } from '@/src/modules/core/components/Button'
import { Card } from '@/src/modules/core/components/Card'
import { EmptyState } from '@/src/modules/core/components/EmptyState'
import { ScreenLayout, ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { log } from '@/src/modules/core/utils/logger'
import { showToast } from '@/src/modules/core/utils/toast'
import { TemplateExerciseSelector } from '../components/TemplateExerciseSelector'
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

    const toggleExercise = useCallback((uuid: string) => {
        setExercisesError('')
        setSelected((current) => {
            const next = new Set(current)
            if (next.has(uuid)) next.delete(uuid)
            else next.add(uuid)
            return next
        })
    }, [])

    // Members not on this device yet stay in `selected` (and are saved) but are
    // not counted: the badge shows what this device can actually offer.
    const selectedCount = resolveMembers(selected, exercises).length

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
            showToast.success({
                title: t(isEditing ? 'templateUpdated' : 'templateCreated'),
                message: result.name,
            })
        } catch (error) {
            log('error', 'Failed to save workout template', error)
            showToast.danger({ title: t('error'), message: t('failedToSaveTemplate') })
        } finally {
            setIsSaving(false)
        }
    }, [isEditing, isSaving, name, selected, selectedCount, t, templateId, templateRepo])

    const handleDelete = useCallback(() => {
        if (templateId === undefined) return
        showToast.confirm({
            title: t('deleteTemplateTitle'),
            message: t('deleteTemplateWarning', { name: name.trim() }),
            icon: 'trash',
            tone: 'danger',
            action: {
                label: t('delete'),
                onPress: async () => {
                    try {
                        await templateRepo.delete(templateId)
                        goBack()
                        showToast.success({ title: t('templateDeleted'), message: name.trim() })
                    } catch (error) {
                        log('error', 'Failed to delete workout template', error)
                        showToast.danger({ title: t('error'), message: t('failedToDeleteTemplate') })
                    }
                },
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
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={!canSave}
                            style={!canSave && styles.headerButtonDisabled}
                            accessibilityRole={'button'}
                            accessibilityLabel={isSaving ? t('saving') : t('save')}
                            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                        >
                            <FontAwesome name={'check'} size={20} color={theme.primary} />
                        </TouchableOpacity>
                        {isEditing && (
                            <TouchableOpacity
                                onPress={handleDelete}
                                accessibilityRole={'button'}
                                accessibilityLabel={t('delete')}
                                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                            >
                                <FontAwesome name={'trash'} size={20} color={theme.error} />
                            </TouchableOpacity>
                        )}
                    </View>
                ),
            })
        }, [canSave, handleDelete, handleSave, isEditing, isSaving, navigation, t, theme])
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
            <Card>
                <View style={styles.field}>
                    <Typography.Label>{t('templateName')}</Typography.Label>
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
                            GlobalStyles.input,
                            styles.nameInput,
                            {
                                color: theme.text,
                                backgroundColor: theme.inputBackground,
                                borderColor: nameError ? theme.error : theme.border,
                            },
                        ]}
                        accessibilityLabel={t('templateName')}
                        accessibilityHint={t('required')}
                    />
                    <Typography.Meta style={{ color: nameError ? theme.error : 'transparent' }} numberOfLines={1}>
                        {nameError || ' '}
                    </Typography.Meta>
                </View>
            </Card>

            <Card>
                <View style={styles.exercisesHeader}>
                    <View style={styles.exercisesTitle}>
                        <Typography.Subtitle>{t('templateExercises')}</Typography.Subtitle>
                        <Typography.Meta color={'textSecondary'}>{t('templateExercisesHint')}</Typography.Meta>
                    </View>
                    <View
                        style={[
                            styles.countBadge,
                            { backgroundColor: selectedCount > 0 ? theme.primary : theme.surfaceMuted },
                        ]}
                    >
                        <Typography.Meta
                            weight={'bold'}
                            style={{ color: selectedCount > 0 ? theme.onPrimary : theme.textSecondary }}
                        >
                            {selectedCount}
                        </Typography.Meta>
                    </View>
                </View>

                {exercisesError ? (
                    <Typography.Meta style={[styles.exercisesError, { color: theme.error }]}>
                        {exercisesError}
                    </Typography.Meta>
                ) : null}

                {exercises.length === 0 ? (
                    <View style={styles.emptyExercises}>
                        <EmptyState
                            message={t('noExercises')}
                            subMessage={t('templateNeedsExercisesFirst')}
                            icon={'list'}
                        />
                        {/* Switch to the Exercises tab rather than pushing its add
                            form into this stack: a cross-tab push leaves the form
                            behind in the Exercises stack after save. */}
                        <Button
                            label={t('goToExercises')}
                            leftIcon={'list'}
                            variant={'secondary'}
                            onPress={() => router.navigate('/(tabs)/exercises')}
                        />
                    </View>
                ) : (
                    <TemplateExerciseSelector exercises={exercises} selected={selected} onToggle={toggleExercise} />
                )}
            </Card>
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
    field: {
        gap: Spacing.sm,
    },
    nameInput: {
        marginBottom: 0,
    },
    exercisesHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: Spacing.md,
        marginBottom: Spacing.md,
    },
    exercisesTitle: {
        flex: 1,
        gap: Spacing.xs,
    },
    countBadge: {
        minWidth: 28,
        height: 28,
        paddingHorizontal: Spacing.sm,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    exercisesError: {
        marginTop: -Spacing.sm,
        marginBottom: Spacing.md,
    },
    emptyExercises: {
        gap: Spacing.md,
    },
    headerBack: {
        paddingLeft: Spacing.md,
        paddingRight: Spacing.sm,
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        marginRight: Spacing.md,
    },
    headerButtonDisabled: {
        opacity: 0.4,
    },
})
