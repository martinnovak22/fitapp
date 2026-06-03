import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { GlobalStyles } from '@/src/constants/Styles'
import { FontSize, FontWeight } from '@/src/constants/Typography'
import { getRepositories } from '@/src/data/repositories'
import { ExerciseType } from '@/src/db/exercises'
import { Button } from '@/src/modules/core/components/Button'
import { Card } from '@/src/modules/core/components/Card'
import { FullScreenImageModal } from '@/src/modules/core/components/FullScreenImageModal'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { showToast } from '@/src/modules/core/utils/toast'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated'
import { ScrollScreenLayout } from '../../core/components/ScreenLayout'
import { buildExerciseSavePayload, validateExerciseForm } from '../exerciseForm'

type ExerciseFormScreenProps = {
    mode?: 'create' | 'edit'
    exerciseId?: number
}

export function ExerciseFormScreen({ mode = 'create', exerciseId }: ExerciseFormScreenProps) {
    const { exercises: exerciseRepo } = getRepositories()
    const { t } = useTranslation()
    const { theme } = useTheme()
    const navigation = useNavigation()
    const { id } = useLocalSearchParams<{ id?: string }>()
    const resolvedExerciseId = exerciseId ?? (id ? Number(id) : undefined)
    const isEditing = mode === 'edit' || resolvedExerciseId !== undefined

    const [name, setName] = useState('')
    const [muscle, setMuscle] = useState('')
    const [type, setType] = useState<ExerciseType>('weight')
    const [photoUri, setPhotoUri] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [showImageFullScreen, setShowImageFullScreen] = useState(false)
    const [nameError, setNameError] = useState('')
    const nameInputRef = useRef<TextInput>(null)
    const muscleInputRef = useRef<TextInput>(null)

    const loadExercise = useCallback(async () => {
        if (!resolvedExerciseId) return
        const exercise = await exerciseRepo.getById(resolvedExerciseId)
        if (exercise) {
            setName(exercise.name)
            setMuscle(exercise.muscle_group || '')
            setType(exercise.type)
            setPhotoUri(exercise.photo_uri || null)
        }
    }, [exerciseRepo, resolvedExerciseId])

    useEffect(() => {
        if (isEditing) {
            loadExercise()
        }
    }, [isEditing, loadExercise])

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync()
        if (status !== 'granted') {
            showToast.info({
                title: t('permissionNeeded'),
                message: t('allowCamera'),
            })
            return
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
        })

        if (!result.canceled) {
            setPhotoUri(result.assets[0].uri)
        }
    }

    const savePhotoPermanently = async (uri: string) => {
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

    const handleSave = useCallback(async () => {
        const validation = validateExerciseForm({ name })
        if (!validation.ok) {
            setNameError(t(validation.nameError))
            nameInputRef.current?.focus()
            return
        }
        setNameError('')

        setIsLoading(true)
        try {
            let finalPhotoUri = photoUri
            const docDir = FileSystem.documentDirectory
            if (photoUri && docDir && !photoUri.includes(docDir)) {
                finalPhotoUri = await savePhotoPermanently(photoUri)
            }

            const payload = buildExerciseSavePayload({ name, muscle, type, photoUri: finalPhotoUri })

            if (isEditing) {
                if (!resolvedExerciseId) return
                await exerciseRepo.update(resolvedExerciseId, payload)
            } else {
                await exerciseRepo.create(
                    payload.name,
                    payload.type,
                    payload.muscle_group,
                    payload.photo_uri ?? undefined
                )
            }
            router.replace('/(tabs)/exercises')
            showToast.success({
                title: isEditing ? t('exerciseUpdated') : t('exerciseCreated'),
                message: isEditing ? `${name} ${t('updated')}` : `${name} ${t('ready')}`,
            })
        } catch (error) {
            console.error('Failed to save exercise:', error)
            showToast.danger({
                title: t('error'),
                message: t('failedToSaveExercise'),
            })
        } finally {
            setIsLoading(false)
        }
    }, [name, muscle, type, photoUri, isEditing, resolvedExerciseId, exerciseRepo, t])

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
                    router.dismissAll()
                    router.replace('/(tabs)/exercises')
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
                <Animated.View layout={LinearTransition.duration(300)} style={{ padding: Spacing.md }}>
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
                            returnKeyType={'next'}
                            blurOnSubmit={false}
                            onSubmitEditing={() => muscleInputRef.current?.focus()}
                            accessibilityLabel={t('name')}
                            accessibilityHint={t('required')}
                        />
                    </View>
                    <View style={styles.helperTextSlot}>
                        <Typography.Meta style={{ color: nameError ? theme.error : 'transparent' }} numberOfLines={1}>
                            {nameError || ' '}
                        </Typography.Meta>
                    </View>

                    <View style={{ gap: Spacing.sm }}>
                        <Typography.Label>{t('muscleGroup')}</Typography.Label>
                        <TextInput
                            ref={muscleInputRef}
                            placeholder={t('placeholderMuscle')}
                            placeholderTextColor={theme.textSecondary}
                            style={[
                                GlobalStyles.input,
                                {
                                    color: theme.text,
                                    backgroundColor: theme.inputBackground,
                                    borderColor: theme.border,
                                },
                            ]}
                            value={muscle}
                            onChangeText={setMuscle}
                            selectionColor={theme.primary}
                            returnKeyType={'done'}
                            onSubmitEditing={handleSave}
                            accessibilityLabel={t('muscleGroup')}
                        />
                    </View>

                    <Typography.Subtitle style={{ marginTop: 16, marginBottom: 12 }}>
                        {t('exerciseType')}
                    </Typography.Subtitle>
                    <Animated.View layout={LinearTransition.duration(300)} style={styles.typeContainer}>
                        {[
                            { label: t('typeWeight'), value: 'weight' as ExerciseType },
                            { label: t('typeCardio'), value: 'cardio' as ExerciseType },
                            { label: t('typeBodyweight'), value: 'bodyweight' as ExerciseType },
                        ].map((t_item) => {
                            const isActive =
                                type === t_item.value || (t_item.value === 'bodyweight' && type === 'bodyweight_timer')
                            return (
                                <TouchableOpacity
                                    key={t_item.value}
                                    style={[
                                        styles.typeButton,
                                        { borderColor: theme.border },
                                        isActive && { backgroundColor: theme.primary, borderColor: theme.primary },
                                    ]}
                                    onPress={() => setType(t_item.value)}
                                    accessibilityRole={'button'}
                                    accessibilityLabel={t_item.label}
                                    accessibilityState={{ selected: isActive }}
                                >
                                    <Typography.Meta
                                        style={[
                                            styles.typeButtonText,
                                            { color: theme.textSecondary },
                                            isActive && { color: theme.onPrimary },
                                        ]}
                                    >
                                        {t_item.label}
                                    </Typography.Meta>
                                </TouchableOpacity>
                            )
                        })}
                    </Animated.View>

                    {/* Tracking Mode Toggle */}
                    {(type === 'bodyweight' || type === 'bodyweight_timer') && (
                        <Animated.View entering={FadeIn} layout={LinearTransition} style={{ marginTop: 20 }}>
                            <Typography.Label style={{ fontSize: FontSize.xs, marginBottom: 6 }}>
                                {t('trackingMode')}
                            </Typography.Label>
                            <View style={[styles.subToggleContainer, { backgroundColor: theme.inputBackground }]}>
                                <TouchableOpacity
                                    style={[
                                        styles.subToggleButton,
                                        { backgroundColor: 'transparent' },
                                        type === 'bodyweight' && [
                                            styles.subToggleButtonActive,
                                            {
                                                backgroundColor: theme.inputBackgroundActive,
                                                borderColor: theme.inputBackgroundActive,
                                            },
                                        ],
                                    ]}
                                    onPress={() => setType('bodyweight')}
                                    accessibilityRole={'button'}
                                    accessibilityLabel={t('reps')}
                                    accessibilityState={{ selected: type === 'bodyweight' }}
                                >
                                    <Typography.Meta
                                        style={[
                                            styles.subToggleText,
                                            { color: theme.textSecondary },
                                            type === 'bodyweight' && [
                                                styles.subToggleTextActive,
                                                { color: theme.text },
                                            ],
                                        ]}
                                    >
                                        {t('reps')}
                                    </Typography.Meta>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.subToggleButton,
                                        { backgroundColor: 'transparent' },
                                        type === 'bodyweight_timer' && [
                                            styles.subToggleButtonActive,
                                            {
                                                backgroundColor: theme.inputBackgroundActive,
                                                borderColor: theme.inputBackgroundActive,
                                            },
                                        ],
                                    ]}
                                    onPress={() => setType('bodyweight_timer')}
                                    accessibilityRole={'button'}
                                    accessibilityLabel={t('timer')}
                                    accessibilityState={{ selected: type === 'bodyweight_timer' }}
                                >
                                    <Typography.Meta
                                        style={[
                                            styles.subToggleText,
                                            { color: theme.textSecondary },
                                            type === 'bodyweight_timer' && [
                                                styles.subToggleTextActive,
                                                { color: theme.text },
                                            ],
                                        ]}
                                    >
                                        {t('timer')}
                                    </Typography.Meta>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    )}

                    <Animated.View entering={FadeIn} layout={LinearTransition} style={styles.photoSection}>
                        <Typography.Subtitle style={{ marginTop: 24, marginBottom: 12 }}>
                            {t('photo')}
                        </Typography.Subtitle>
                        {photoUri ? (
                            <TouchableOpacity
                                style={[
                                    styles.photoWrapper,
                                    {
                                        backgroundColor: theme.surfaceSubtle,
                                        borderColor: theme.inputBackgroundActive,
                                    },
                                ]}
                                onPress={() => setShowImageFullScreen(true)}
                                accessibilityRole={'button'}
                                accessibilityLabel={t('photo')}
                            >
                                <Image key={photoUri} source={{ uri: photoUri }} style={styles.photo} />
                                <Button
                                    leftIcon={'trash'}
                                    onPress={() => setPhotoUri(null)}
                                    variant={'text'}
                                    accessibilityLabel={t('delete')}
                                    labelStyle={{ color: theme.error }}
                                    style={[styles.removePhotoButton, { backgroundColor: theme.overlayScrim }]}
                                />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[
                                    styles.addPhotoButton,
                                    {
                                        backgroundColor: theme.surfaceSubtle,
                                        borderColor: theme.inputBackground,
                                    },
                                ]}
                                onPress={handlePickImage}
                                accessibilityRole={'button'}
                                accessibilityLabel={t('photo')}
                            >
                                <FontAwesome name={'camera'} size={30} color={theme.primary} />
                                <Typography.Meta style={[styles.addPhotoText, { color: theme.primary }]}>
                                    {t('photo')}
                                </Typography.Meta>
                            </TouchableOpacity>
                        )}
                    </Animated.View>
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

const styles = StyleSheet.create({
    helperTextSlot: {
        minHeight: 18,
        marginTop: -Spacing.sm,
        marginBottom: Spacing.sm,
    },
    typeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    photoSection: {
        marginBottom: Spacing.sm,
    },
    addPhotoButton: {
        width: '100%',
        height: 160,
        borderRadius: Radius.md,
        borderWidth: 2,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    addPhotoText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
    },
    photoWrapper: {
        width: '100%',
        height: 160,
        borderRadius: Radius.md,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 1,
    },
    photo: {
        height: 160,
        width: '100%',
        resizeMode: 'cover',
    },
    removePhotoButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 30,
        height: 30,
        borderRadius: Radius.pill,
        justifyContent: 'center',
        alignItems: 'center',
    },
    typeButton: {
        flex: 1,
        minWidth: '30%',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.sm,
        borderWidth: 1,
        alignItems: 'center',
    },
    typeButtonText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
    },
    subToggleContainer: {
        flexDirection: 'row',
        borderRadius: Radius.sm,
        padding: 4,
    },
    subToggleButton: {
        flex: 1,
        paddingVertical: Spacing.xs,
        alignItems: 'center',
        borderRadius: Radius.sm,
    },
    subToggleButtonActive: {
        borderWidth: 1,
    },
    subToggleText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
    },
    subToggleTextActive: {
        fontWeight: FontWeight.bold,
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
