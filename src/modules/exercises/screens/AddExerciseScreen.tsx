import FontAwesome from '@expo/vector-icons/FontAwesome'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { Motion } from '@/src/constants/Motion'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontSize, FontWeight } from '@/src/constants/Typography'
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
import { Button } from '@/src/modules/core/components/Button'
import { confirmDialog } from '@/src/modules/core/components/ConfirmDialog'
import { FullScreenImageModal } from '@/src/modules/core/components/FullScreenImageModal'
import { ListRow } from '@/src/modules/core/components/ListRow'
import { ListSection } from '@/src/modules/core/components/ListSection'
import { SelectSheet } from '@/src/modules/core/components/SelectSheet'
import { Sheet } from '@/src/modules/core/components/Sheet'
import { summarizeSelection } from '@/src/modules/core/components/selectOptions'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { log } from '@/src/modules/core/utils/logger'
import { showToast } from '@/src/modules/core/utils/toast'
import { ScrollScreenLayout } from '../../core/components/ScreenLayout'
import {
    buildExerciseSavePayload,
    changedTaxonomyOnly,
    type LoadedTaxonomy,
    NO_SUGGESTIONS,
    resolveExerciseSavePlan,
    shouldPersistPhoto,
    suggestTaxonomyForType,
} from '../exerciseForm'
import { equipmentLabel, muscleLabel } from '../taxonomyLabels'
import { equipmentFromOption, equipmentOptions, muscleOptions, NO_EQUIPMENT } from '../taxonomyOptions'
import { ExercisePhotoThumb, ExerciseTypeField, PHOTO_THUMB_SIZE } from './components/ExerciseFormSections'

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
    const [openSheet, setOpenSheet] = useState<'primary' | 'secondary' | 'equipment' | 'photo' | null>(null)
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

    const handleDelete = useCallback(() => {
        confirmDialog({
            title: t('deleteExerciseTitle'),
            message: t('deleteExerciseWarning'),
            confirmLabel: t('delete'),
            destructive: true,
            onConfirm: async () => {
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
            },
        })
    }, [resolvedExerciseId, exerciseRepo, t])

    const canSave = name.trim().length > 0 && !isLoading
    useFocusEffect(
        useCallback(() => {
            navigation.getParent()?.setOptions({
                headerTitle: isEditing ? t('editExercise') : t('newExercise'),
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
                    <Button
                        label={t('save')}
                        variant={'text'}
                        onPress={handleSave}
                        disabled={!canSave}
                        isLoading={isLoading}
                        style={styles.headerSave}
                    />
                ),
            })
        }, [navigation, isEditing, theme, t, handleSave, canSave, isLoading])
    )

    const primaryOptions = useMemo(() => muscleOptions(t), [t])
    const secondaryOptions = useMemo(() => muscleOptions(t, primaryMuscle ? [primaryMuscle] : []), [t, primaryMuscle])
    const equipmentChoices = useMemo(() => equipmentOptions(t), [t])
    const closeSheet = () => setOpenSheet(null)

    // The sheet closes before the camera or gallery opens, so only one modal
    // is ever on screen.
    const pickFromSheet = (source: 'camera' | 'gallery') => {
        closeSheet()
        pickImage(source)
    }

    return (
        <ScrollScreenLayout keyboardShouldPersistTaps={'handled'}>
            <Animated.View layout={FORM_LAYOUT} style={styles.form}>
                <View style={styles.nameRow}>
                    <ExercisePhotoThumb photoUri={photoUri} onPress={() => setOpenSheet('photo')} />
                    <View style={styles.nameField}>
                        <TextInput
                            ref={nameInputRef}
                            placeholder={t('placeholderName')}
                            placeholderTextColor={theme.textSecondary}
                            style={[
                                styles.nameInput,
                                {
                                    color: theme.text,
                                    backgroundColor: theme.inputBackground,
                                    borderColor: nameError ? theme.error : 'transparent',
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
                        {nameError ? <Typography.Meta color={'error'}>{nameError}</Typography.Meta> : null}
                    </View>
                </View>

                <ExerciseTypeField type={type} onTypeChange={handleTypeChange} onTrackingModeChange={setType} />

                <ListSection footer={t('primaryMuscleHint')}>
                    <ListRow
                        label={t('primaryMuscle')}
                        value={primaryMuscle ? muscleLabel(t, primaryMuscle) : t('choose')}
                        error={primaryMuscleError || undefined}
                        accessory={'chevron'}
                        onPress={() => setOpenSheet('primary')}
                    />
                    <ListRow
                        label={t('secondaryMuscles')}
                        value={
                            secondaryMuscles.length > 0
                                ? summarizeSelection(secondaryMuscles.map((key) => muscleLabel(t, key)))
                                : t('none')
                        }
                        accessory={'chevron'}
                        onPress={() => setOpenSheet('secondary')}
                    />
                    <ListRow
                        label={t('equipment')}
                        value={equipment ? equipmentLabel(t, equipment) : t('none')}
                        accessory={'chevron'}
                        onPress={() => setOpenSheet('equipment')}
                    />
                </ListSection>

                {isEditing && (
                    <ListSection>
                        <ListRow label={t('deleteExercise')} leadingIcon={'trash'} destructive onPress={handleDelete} />
                    </ListSection>
                )}
            </Animated.View>

            <SelectSheet
                visible={openSheet === 'primary'}
                onClose={closeSheet}
                title={t('primaryMuscle')}
                mode={'single'}
                options={primaryOptions}
                value={primaryMuscle}
                onSelect={selectPrimaryMuscle}
            />
            <SelectSheet
                visible={openSheet === 'secondary'}
                onClose={closeSheet}
                title={t('secondaryMuscles')}
                mode={'multi'}
                options={secondaryOptions}
                values={secondaryMuscles}
                onChange={setSecondaryMuscles}
            />
            <SelectSheet
                visible={openSheet === 'equipment'}
                onClose={closeSheet}
                title={t('equipment')}
                mode={'single'}
                searchable={false}
                options={equipmentChoices}
                value={equipment ?? NO_EQUIPMENT}
                onSelect={(value) => {
                    suggestedRef.current = { ...suggestedRef.current, equipment: false }
                    setEquipment(equipmentFromOption(value))
                }}
            />
            <Sheet flush visible={openSheet === 'photo'} onClose={closeSheet} title={t('photo')}>
                <View>
                    <ListRow label={t('takePhoto')} leadingIcon={'camera'} onPress={() => pickFromSheet('camera')} />
                    <ListRow
                        label={t('pickFromGallery')}
                        leadingIcon={'image'}
                        onPress={() => pickFromSheet('gallery')}
                    />
                    {photoUri && (
                        <ListRow
                            label={t('viewPhoto')}
                            leadingIcon={'expand'}
                            onPress={() => {
                                closeSheet()
                                setShowImageFullScreen(true)
                            }}
                        />
                    )}
                    {photoUri && (
                        <ListRow
                            label={t('removePhoto')}
                            leadingIcon={'trash'}
                            destructive
                            onPress={() => {
                                closeSheet()
                                setPhotoUri(null)
                            }}
                        />
                    )}
                </View>
            </Sheet>
            {photoUri && (
                <FullScreenImageModal
                    visible={showImageFullScreen}
                    onClose={() => setShowImageFullScreen(false)}
                    imageUri={photoUri}
                />
            )}
        </ScrollScreenLayout>
    )
}

export default function AddExerciseScreen() {
    return <ExerciseFormScreen mode="create" />
}

// The form is the single layout owner for the Tracking Mode control toggling
// inside it, on the shared motion clock so the reflow matches its fade.
const FORM_LAYOUT = Motion.layout()

const styles = StyleSheet.create({
    form: {
        gap: Spacing.lg,
        paddingBottom: Spacing.lg,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm + Spacing.xs,
    },
    nameField: {
        flex: 1,
        gap: Spacing.xs,
    },
    nameInput: {
        minHeight: PHOTO_THUMB_SIZE,
        borderRadius: Radius.sm,
        borderWidth: 1,
        paddingHorizontal: Spacing.md,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
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
