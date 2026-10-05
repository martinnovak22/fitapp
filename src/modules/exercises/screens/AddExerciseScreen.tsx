import FontAwesome from '@expo/vector-icons/FontAwesome'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { Motion } from '@/src/constants/Motion'
import { Spacing } from '@/src/constants/Spacing'
import { GlobalStyles } from '@/src/constants/Styles'
import { useExerciseRepo } from '@/src/data/RepositoryContext'
import { deleteLocalPhoto } from '@/src/data/sync/photoStorage'
import type { ExerciseType } from '@/src/db/exercises'
import {
    asMuscleKey,
    type Equipment,
    hasExplicitMuscles,
    isEquipment,
    type MuscleKey,
    resolveExerciseMuscles,
} from '@/src/domain/exerciseTaxonomy'
import { Card } from '@/src/modules/core/components/Card'
import { FullScreenImageModal } from '@/src/modules/core/components/FullScreenImageModal'
import { Appear } from '@/src/modules/core/components/motion'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { log } from '@/src/modules/core/utils/logger'
import { showToast } from '@/src/modules/core/utils/toast'
import { ScrollScreenLayout } from '../../core/components/ScreenLayout'
import { EquipmentPicker } from '../components/EquipmentPicker'
import { MusclePicker } from '../components/MusclePicker'
import {
    buildExerciseSavePayload,
    changedTaxonomyOnly,
    type LoadedTaxonomy,
    NO_SUGGESTIONS,
    resolveExerciseSavedToast,
    resolveExerciseSavePlan,
    shouldPersistPhoto,
    suggestTaxonomyForType,
} from '../exerciseForm'
import { ExercisePhotoField, ExerciseTypeSelector, TrackingModeToggle } from './components/ExerciseFormSections'

async function savePhotoPermanently(uri: string): Promise<string> {
    const docDir = FileSystem.documentDirectory
    if (!docDir) return uri
    if (!uri) return uri

    // Already persisted in app storage.
    if (uri.includes(docDir)) return uri

    const filename = `${Date.now()}.jpg`
    const dest = `${docDir}exercises/${filename}`

    // Ensure directory exists
    const dir = `${docDir}exercises/`
    const dirInfo = await FileSystem.getInfoAsync(dir)
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    }

    await FileSystem.copyAsync({
        from: uri,
        to: dest,
    })

    return dest
}

type ExerciseFormScreenProps = {
    mode?: 'create' | 'edit'
    exerciseId?: number
}

export function ExerciseFormScreen({ mode = 'create', exerciseId }: ExerciseFormScreenProps) {
    const exerciseRepo = useExerciseRepo()
    const { t } = useTranslation()
    const { theme } = useTheme()
    const navigation = useNavigation()
    const { id } = useLocalSearchParams<{ id?: string }>()
    const resolvedExerciseId = exerciseId ?? (id ? Number(id) : undefined)
    const isEditing = mode === 'edit' || resolvedExerciseId !== undefined

    const [name, setName] = useState('')
    const [primaryMuscle, setPrimaryMuscle] = useState<MuscleKey | null>(null)
    const [secondaryMuscles, setSecondaryMuscles] = useState<MuscleKey[]>([])
    const [showSecondary, setShowSecondary] = useState(false)
    const [equipment, setEquipment] = useState<Equipment | null>(null)
    const [type, setType] = useState<ExerciseType>('weight')
    const [photoUri, setPhotoUri] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [showImageFullScreen, setShowImageFullScreen] = useState(false)
    const [nameError, setNameError] = useState('')
    const [primaryMuscleError, setPrimaryMuscleError] = useState('')
    const nameInputRef = useRef<TextInput>(null)
    // Which taxonomy values were filled in by a type suggestion, not the user.
    const suggestedRef = useRef(NO_SUGGESTIONS)
    // What the edit form opened with, so a save only writes what changed.
    const loadedTaxonomyRef = useRef<LoadedTaxonomy | null>(null)
    const originalPhotoUriRef = useRef<string | null>(null)

    const loadExercise = useCallback(async () => {
        if (!resolvedExerciseId) return
        const exercise = await exerciseRepo.getById(resolvedExerciseId)
        if (exercise) {
            setName(exercise.name)
            // Exercises saved before the taxonomy arrive pre-filled from their
            // legacy text, so saving the form makes the mapping explicit.
            const muscles = resolveExerciseMuscles(exercise)
            setPrimaryMuscle(muscles.primary)
            setSecondaryMuscles(muscles.secondary)
            setShowSecondary(muscles.secondary.length > 0)
            const loadedEquipment = isEquipment(exercise.equipment) ? exercise.equipment : null
            setEquipment(loadedEquipment)
            // Only keys written by a newer client need protecting from a no-op
            // save; legacy or stale-mirror rows count as "nothing stored", so
            // any save makes their mapping explicit.
            const hasUnknownPrimary = !!exercise.primary_muscle && !asMuscleKey(exercise.primary_muscle)
            loadedTaxonomyRef.current = {
                primaryMuscle: hasUnknownPrimary || hasExplicitMuscles(exercise) ? muscles.primary : null,
                secondaryMuscles: muscles.secondary,
                equipment: loadedEquipment,
            }
            setType(exercise.type)
            setPhotoUri(exercise.photo_uri || null)
            originalPhotoUriRef.current = exercise.photo_uri || null
        }
    }, [exerciseRepo, resolvedExerciseId])

    useEffect(() => {
        if (isEditing) {
            loadExercise()
        }
    }, [isEditing, loadExercise])

    const pickImage = async (source: 'camera' | 'gallery') => {
        try {
            // The gallery path needs no permission: launchImageLibraryAsync uses the OS photo picker.
            if (source === 'camera') {
                const { status } = await ImagePicker.requestCameraPermissionsAsync()
                if (status !== 'granted') {
                    showToast.info({
                        title: t('permissionNeeded'),
                        message: t('allowCamera'),
                    })
                    return
                }
            }

            const options: ImagePicker.ImagePickerOptions = {
                mediaTypes: ['images'],
                quality: 0.7,
            }
            const result =
                source === 'camera'
                    ? await ImagePicker.launchCameraAsync(options)
                    : await ImagePicker.launchImageLibraryAsync(options)

            const uri = result.canceled ? null : result.assets?.[0]?.uri
            if (uri) {
                setPhotoUri(uri)
            }
        } catch (error) {
            log('error', 'Failed to pick photo', error)
            showToast.danger({
                title: t('error'),
                message: t(source === 'camera' ? 'cameraFailed' : 'galleryFailed'),
            })
        }
    }

    const handleSave = useCallback(async () => {
        const plan = resolveExerciseSavePlan({ name, primaryMuscle, isEditing, resolvedExerciseId })
        if (plan.kind === 'invalid') {
            setNameError(plan.nameError ? t(plan.nameError) : '')
            setPrimaryMuscleError(plan.primaryMuscleError ? t(plan.primaryMuscleError) : '')
            if (plan.nameError) {
                nameInputRef.current?.focus()
            } else if (plan.primaryMuscleError) {
                // The inline error may be scrolled out of view; say it where it's seen.
                showToast.info({ title: t('primaryMuscle'), message: t(plan.primaryMuscleError) })
            }
            return
        }
        if (plan.kind === 'noop') return
        setNameError('')
        setPrimaryMuscleError('')

        setIsLoading(true)
        try {
            let finalPhotoUri = photoUri
            if (photoUri && shouldPersistPhoto(photoUri, FileSystem.documentDirectory)) {
                finalPhotoUri = await savePhotoPermanently(photoUri)
            }

            const payload = buildExerciseSavePayload({
                name,
                primaryMuscle,
                secondaryMuscles,
                equipment,
                type,
                photoUri: finalPhotoUri,
            })

            if (plan.kind === 'update') {
                const loaded = loadedTaxonomyRef.current
                await exerciseRepo.update(plan.exerciseId, loaded ? changedTaxonomyOnly(payload, loaded) : payload)
                if (originalPhotoUriRef.current !== finalPhotoUri) {
                    await deleteLocalPhoto(originalPhotoUriRef.current)
                    originalPhotoUriRef.current = finalPhotoUri
                }
            } else {
                await exerciseRepo.create(payload.name, payload.type, payload)
            }
            // Pop back to the already-mounted list instead of replacing it, so it
            // reloads in place (the new/edited row just appears) rather than
            // remounting and re-flashing its skeleton. Mirrors the header back.
            if (router.canGoBack()) {
                router.back()
            } else {
                router.replace('/(tabs)/exercises')
            }
            const toast = resolveExerciseSavedToast(isEditing, name)
            showToast.success({
                title: t(toast.titleKey),
                message: `${toast.name} ${t(toast.messageNameKey)}`,
            })
        } catch (error) {
            log('error', 'Failed to save exercise', error)
            showToast.danger({
                title: t('error'),
                message: t('failedToSaveExercise'),
            })
        } finally {
            setIsLoading(false)
        }
    }, [
        name,
        primaryMuscle,
        secondaryMuscles,
        equipment,
        type,
        photoUri,
        isEditing,
        resolvedExerciseId,
        exerciseRepo,
        t,
    ])

    const handleTypeChange = useCallback(
        (nextType: ExerciseType) => {
            setType(nextType)
            // Only a new exercise gets defaults; editing never rewrites choices.
            if (isEditing) return
            const suggestion = suggestTaxonomyForType(nextType, {
                primaryMuscle,
                equipment,
                suggested: suggestedRef.current,
            })
            suggestedRef.current = suggestion.suggested
            setPrimaryMuscle(suggestion.primaryMuscle)
            setEquipment(suggestion.equipment)
        },
        [equipment, isEditing, primaryMuscle]
    )

    const selectPrimaryMuscle = useCallback((key: MuscleKey) => {
        suggestedRef.current = { ...suggestedRef.current, primaryMuscle: false }
        setPrimaryMuscle(key)
        setPrimaryMuscleError('')
        setSecondaryMuscles((current) => current.filter((muscle) => muscle !== key))
    }, [])

    const toggleSecondaryMuscle = useCallback((key: MuscleKey) => {
        setSecondaryMuscles((current) =>
            current.includes(key) ? current.filter((muscle) => muscle !== key) : [...current, key]
        )
    }, [])

    const handleDelete = useCallback(() => {
        showToast.confirm({
            title: t('deleteExerciseTitle'),
            message: t('deleteExerciseWarning'),
            icon: 'trash',
            tone: 'danger',
            action: {
                label: t('delete'),
                onPress: async () => {
                    if (!resolvedExerciseId) return
                    await exerciseRepo.delete(resolvedExerciseId)
                    await deleteLocalPhoto(originalPhotoUriRef.current)
                    // Pop the detail/edit stack back to the already-mounted list so
                    // it reloads in place (the row disappears) instead of remounting
                    // and re-flashing its skeleton. Mirrors the save path.
                    if (router.canDismiss()) {
                        router.dismissAll()
                    } else {
                        router.replace('/(tabs)/exercises')
                    }
                    showToast.success({
                        title: t('exerciseDeleted'),
                        message: t('exerciseRemoved'),
                    })
                },
            },
        })
    }, [resolvedExerciseId, exerciseRepo, t])

    const canSave = name.trim().length > 0 && !isLoading
    useFocusEffect(
        useCallback(() => {
            navigation.getParent()?.setOptions({
                headerTitle: t('exerciseTitle'),
                headerLeft: () => (
                    <TouchableOpacity
                        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/exercises'))}
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
                            accessibilityLabel={isLoading ? t('saving') : t('save')}
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
        }, [navigation, isEditing, theme, t, handleDelete, handleSave, canSave, isLoading])
    )

    return (
        <ScrollScreenLayout>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <Animated.View layout={CARD_LAYOUT} style={{ padding: Spacing.md }}>
                    <Typography.Subtitle style={{ marginBottom: Spacing.md }}>
                        {t('exerciseDetails')}
                    </Typography.Subtitle>

                    <View style={{ gap: Spacing.sm }}>
                        <Typography.Label>{t('name')}</Typography.Label>
                        <TextInput
                            ref={nameInputRef}
                            placeholder={t('placeholderName')}
                            placeholderTextColor={theme.textSecondary}
                            style={[
                                GlobalStyles.input,
                                {
                                    color: theme.text,
                                    backgroundColor: theme.inputBackground,
                                    borderColor: nameError ? theme.error : theme.border,
                                },
                            ]}
                            value={name}
                            onChangeText={(value) => {
                                setName(value)
                                if (nameError) setNameError('')
                            }}
                            autoFocus={!isEditing}
                            selectionColor={theme.primary}
                            returnKeyType={'done'}
                            accessibilityLabel={t('name')}
                            accessibilityHint={t('required')}
                        />
                    </View>
                    <View style={styles.helperTextSlot}>
                        <Typography.Meta style={{ color: nameError ? theme.error : 'transparent' }} numberOfLines={1}>
                            {nameError || ' '}
                        </Typography.Meta>
                    </View>

                    <View style={styles.typeSection}>
                        <Typography.Subtitle>{t('exerciseType')}</Typography.Subtitle>
                        <ExerciseTypeSelector type={type} onSelect={handleTypeChange} />
                    </View>

                    <TrackingModeToggle type={type} onSelect={setType} />

                    <View style={styles.taxonomySection}>
                        <View style={styles.sectionHeading}>
                            <Typography.Subtitle>{t('primaryMuscle')}</Typography.Subtitle>
                            <Typography.Meta color={'textSecondary'}>{t('primaryMuscleHint')}</Typography.Meta>
                            {primaryMuscleError ? (
                                <Typography.Meta style={{ color: theme.error }}>{primaryMuscleError}</Typography.Meta>
                            ) : null}
                        </View>
                        <MusclePicker
                            mode={'single'}
                            selected={primaryMuscle ? [primaryMuscle] : []}
                            onToggle={selectPrimaryMuscle}
                        />
                    </View>

                    <View style={styles.taxonomySection}>
                        <TouchableOpacity
                            onPress={() => setShowSecondary((current) => !current)}
                            style={styles.disclosure}
                            accessibilityRole={'button'}
                            accessibilityState={{ expanded: showSecondary }}
                        >
                            <View style={styles.sectionHeading}>
                                <Typography.Subtitle>
                                    {t('secondaryMuscles')}
                                    {secondaryMuscles.length > 0 ? ` (${secondaryMuscles.length})` : ''}
                                </Typography.Subtitle>
                                <Typography.Meta color={'textSecondary'}>{t('secondaryMusclesHint')}</Typography.Meta>
                            </View>
                            <FontAwesome
                                name={showSecondary ? 'chevron-up' : 'chevron-down'}
                                size={12}
                                color={theme.textSecondary}
                            />
                        </TouchableOpacity>
                        {/* The card's own layout transition owns the height change; a
                            Collapsible here would add a second layout clock. */}
                        {showSecondary && (
                            <Appear style={styles.collapsibleBody}>
                                <MusclePicker
                                    mode={'multi'}
                                    selected={secondaryMuscles}
                                    onToggle={toggleSecondaryMuscle}
                                    disabledKeys={primaryMuscle ? [primaryMuscle] : []}
                                />
                            </Appear>
                        )}
                    </View>

                    <View style={styles.taxonomySection}>
                        <View style={styles.sectionHeading}>
                            <Typography.Subtitle>{t('equipment')}</Typography.Subtitle>
                            <Typography.Meta color={'textSecondary'}>{t('equipmentHint')}</Typography.Meta>
                        </View>
                        <EquipmentPicker
                            value={equipment}
                            onChange={(value) => {
                                suggestedRef.current = { ...suggestedRef.current, equipment: false }
                                setEquipment(value)
                            }}
                        />
                    </View>

                    <ExercisePhotoField
                        photoUri={photoUri}
                        onOpenFullScreen={() => setShowImageFullScreen(true)}
                        onRemove={() => setPhotoUri(null)}
                        onPick={() => pickImage('camera')}
                        onPickFromGallery={() => pickImage('gallery')}
                    />
                </Animated.View>
                {photoUri && (
                    <FullScreenImageModal
                        visible={showImageFullScreen}
                        onClose={() => setShowImageFullScreen(false)}
                        imageUri={photoUri}
                    />
                )}
            </Card>
        </ScrollScreenLayout>
    )
}

export default function AddExerciseScreen() {
    return <ExerciseFormScreen mode="create" />
}

// The card is the single layout owner for every toggled block inside it, on
// the shared motion clock so the reflow matches their fades.
const CARD_LAYOUT = Motion.layout()

const styles = StyleSheet.create({
    typeSection: {
        gap: Spacing.sm + Spacing.xs,
    },
    taxonomySection: {
        marginTop: Spacing.lg,
        gap: Spacing.md,
    },
    sectionHeading: {
        flex: 1,
        gap: Spacing.xs,
    },
    disclosure: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    collapsibleBody: {
        paddingTop: Spacing.xs,
    },
    helperTextSlot: {
        minHeight: 18,
        marginTop: -Spacing.sm,
        marginBottom: Spacing.sm,
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
