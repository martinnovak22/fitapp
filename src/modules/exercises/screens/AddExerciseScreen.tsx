import { GlobalStyles } from '@/src/constants/Styles';
import { ExerciseRepository, ExerciseType } from '@/src/db/exercises';
import { Button } from '@/src/modules/core/components/Button';
import { Card } from '@/src/modules/core/components/Card';
import { FullScreenImageModal } from '@/src/modules/core/components/FullScreenImageModal';
import { ScreenHeader } from '@/src/modules/core/components/ScreenHeader';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { Typography } from '@/src/modules/core/components/Typography';
import { useTheme } from '@/src/modules/core/hooks/useTheme';
import { showToast } from '@/src/modules/core/utils/toast';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

export default function AddExerciseScreen() {
    const { t } = useTranslation();
    const { theme, isDark } = useTheme();
    const { id } = useLocalSearchParams();
    const isEditing = !!id;

    const [name, setName] = useState('');
    const [muscle, setMuscle] = useState('');
    const [type, setType] = useState<ExerciseType>('weight');
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showImageFullScreen, setShowImageFullScreen] = useState(false);

    useEffect(() => {
        if (isEditing) {
            loadExercise();
        }
    }, [id]);

    const loadExercise = async () => {
        const exercise = await ExerciseRepository.getById(Number(id));
        if (exercise) {
            setName(exercise.name);
            setMuscle(exercise.muscle_group || '');
            setType(exercise.type);
            setPhotoUri(exercise.photo_uri || null);
        }
    };

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            showToast.danger({
                title: t('permissionNeeded'),
                message: t('allowCamera')
            });
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
        });

        if (!result.canceled) {
            setPhotoUri(result.assets[0].uri);
        }
    };

    const savePhotoPermanently = async (uri: string) => {
        const docDir = FileSystem.documentDirectory;
        if (!docDir) return uri;

        if (!uri || uri.startsWith('file:///')) {
            // Check if it's already in permanent storage
            if (uri.includes(docDir)) return uri;
        }

        const filename = `${Date.now()}.jpg`;
        const dest = `${docDir}exercises/${filename}`;

        // Ensure directory exists
        const dir = `${docDir}exercises/`;
        const dirInfo = await FileSystem.getInfoAsync(dir);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        }

        await FileSystem.copyAsync({
            from: uri,
            to: dest
        });

        return dest;
    };

    const handleSave = async () => {
        if (!name.trim()) {
            showToast.danger({
                title: t('required'),
                message: t('enterName')
            });
            return;
        }

        setIsLoading(true);
        try {
            let finalPhotoUri = photoUri;
            const docDir = FileSystem.documentDirectory;
            if (photoUri && docDir && !photoUri.includes(docDir)) {
                finalPhotoUri = await savePhotoPermanently(photoUri);
            }

            if (isEditing) {
                await ExerciseRepository.update(Number(id), {
                    name: name.trim(),
                    muscle_group: muscle.trim().toLowerCase() || undefined,
                    type: type.toLowerCase() as ExerciseType,
                    photo_uri: finalPhotoUri
                });
            } else {
                await ExerciseRepository.create(
                    name.trim(),
                    type.toLowerCase() as ExerciseType,
                    muscle.trim().toLowerCase() || undefined,
                    finalPhotoUri ?? undefined
                );
            }
            router.replace('/(tabs)/exercises');
            showToast.success({
                title: isEditing ? t('exerciseUpdated') : t('exerciseCreated'),
                message: isEditing ? `${name} ${t('updated')}` : `${name} ${t('ready')}`
            });
        } catch (error) {
            console.error('Failed to save exercise:', error);
            showToast.danger({
                title: t('error'),
                message: t('failedToSaveExercise')
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = () => {
        showToast.confirm({
            title: t('delete'),
            message: t('deleteExerciseWarning'),
            icon: 'trash',
            action: {
                label: t('delete'),
                onPress: async () => {
                    await ExerciseRepository.delete(Number(id));
                    router.dismissAll();
                    router.replace('/(tabs)/exercises');
                    showToast.success({
                        title: t('exerciseDeleted'),
                        message: t('exerciseRemoved')
                    });

                }
            }
        });
    };

    return (
        <ScreenLayout>
            <ScreenHeader
                title={isEditing ? t('editExercise') : t('addExercise')}
                onDelete={isEditing ? handleDelete : undefined}
            />
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                    <Animated.View layout={LinearTransition.duration(300)} style={{ padding: 16 }}>
                        <Typography.Subtitle style={{ marginBottom: 12 }}>{t('exerciseDetails')}</Typography.Subtitle>

                        <Typography.Label>{t('name')}</Typography.Label>
                        <TextInput
                            placeholder={t('placeholderName')}
                            placeholderTextColor={theme.textSecondary}
                            style={[GlobalStyles.input, { color: theme.text, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}
                            value={name}
                            onChangeText={setName}
                            autoFocus={!isEditing}
                            selectionColor={theme.primary}
                        />

                        <Typography.Label>{t('muscleGroup')}</Typography.Label>
                        <TextInput
                            placeholder={t('placeholderMuscle')}
                            placeholderTextColor={theme.textSecondary}
                            style={[GlobalStyles.input, { color: theme.text, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}
                            value={muscle}
                            onChangeText={setMuscle}
                            selectionColor={theme.primary}
                        />

                        <Typography.Subtitle style={{ marginTop: 16, marginBottom: 12 }}>{t('exerciseType')}</Typography.Subtitle>
                        <Animated.View layout={LinearTransition.duration(300)} style={styles.typeContainer}>
                            {[
                                { label: t('typeWeight'), value: 'weight' as ExerciseType },
                                { label: t('typeCardio'), value: 'cardio' as ExerciseType },
                                { label: t('typeBodyweight'), value: 'bodyweight' as ExerciseType },
                            ].map((t_item) => {
                                const isActive = type === t_item.value || (t_item.value === 'bodyweight' && type === 'bodyweight_timer');
                                return (
                                    <TouchableOpacity
                                        key={t_item.value}
                                        style={[
                                            styles.typeButton,
                                            { borderColor: theme.border },
                                            isActive && { backgroundColor: theme.primary, borderColor: theme.primary }
                                        ]}
                                        onPress={() => setType(t_item.value)}
                                    >
                                        <Typography.Meta style={[
                                            styles.typeButtonText,
                                            { color: theme.textSecondary },
                                            isActive && { color: 'white' }
                                        ]}>
                                            {t_item.label}
                                        </Typography.Meta>
                                    </TouchableOpacity>
                                );
                            })}
                        </Animated.View>

                        {/* Tracking Mode Toggle */}
                        {(type === 'bodyweight' || type === 'bodyweight_timer') && (
                            <Animated.View
                                entering={FadeIn}
                                layout={LinearTransition}
                                style={{ marginTop: 20 }}
                            >
                                <Typography.Label style={{ fontSize: 12, marginBottom: 6 }}>{t('trackingMode')}</Typography.Label>
                                <View style={[styles.subToggleContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                                    <TouchableOpacity
                                        style={[
                                            styles.subToggleButton,
                                            { backgroundColor: 'transparent' },
                                            type === 'bodyweight' && [styles.subToggleButtonActive, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]
                                        ]}
                                        onPress={() => setType('bodyweight')}
                                    >
                                        <Typography.Meta style={[
                                            styles.subToggleText,
                                            { color: theme.textSecondary },
                                            type === 'bodyweight' && [styles.subToggleTextActive, { color: theme.text }]
                                        ]}>{t('reps')}</Typography.Meta>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.subToggleButton,
                                            { backgroundColor: 'transparent' },
                                            type === 'bodyweight_timer' && [styles.subToggleButtonActive, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]
                                        ]}
                                        onPress={() => setType('bodyweight_timer')}
                                    >
                                        <Typography.Meta style={[
                                            styles.subToggleText,
                                            { color: theme.textSecondary },
                                            type === 'bodyweight_timer' && [styles.subToggleTextActive, { color: theme.text }]
                                        ]}>{t('timer')}</Typography.Meta>
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>
                        )}


                        <Animated.View entering={FadeIn} layout={LinearTransition} style={styles.photoSection}>
                            <Typography.Subtitle style={{ marginTop: 24, marginBottom: 12 }}>{t('photo')}</Typography.Subtitle>
                            {photoUri ? (
                                <TouchableOpacity
                                    style={[
                                        styles.photoWrapper,
                                        {
                                            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                        }
                                    ]}
                                    onPress={() => setShowImageFullScreen(true)}
                                >
                                    <Image key={photoUri} source={{ uri: photoUri }} style={styles.photo} />
                                    <TouchableOpacity
                                        style={styles.removePhotoButton}
                                        onPress={() => setPhotoUri(null)}
                                    >
                                        <FontAwesome name={"trash"} size={20} color={"#FF6B6B"} />
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={[
                                        styles.addPhotoButton,
                                        {
                                            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                                            borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
                                        }
                                    ]}
                                    onPress={handlePickImage}
                                >
                                    <FontAwesome name={"camera"} size={30} color={theme.primary} />
                                    <Typography.Meta style={[styles.addPhotoText, { color: theme.primary }]}>{t('photo')}</Typography.Meta>
                                </TouchableOpacity>
                            )}
                        </Animated.View>

                        <Animated.View layout={LinearTransition.duration(300)}>
                            <Button
                                label={isLoading ? t('loading') : (isEditing ? t('saveChanges') : t('createExercise'))}
                                onPress={handleSave}
                                isLoading={isLoading}
                                style={{ marginTop: 24 }}
                            />
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
            </ScrollView>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    typeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    photoSection: {
        marginBottom: 8,
    },
    addPhotoButton: {
        width: '100%',
        height: 120,
        borderRadius: 12,
        borderWidth: 2,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    addPhotoText: {
        fontSize: 14,
        fontWeight: '600',
    },
    photoWrapper: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 1,
    },
    photo: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    removePhotoButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        width: 30,
        height: 30,
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    typeButton: {
        flex: 1,
        minWidth: '30%',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    typeButtonActive: {
        // backgroundColor: theme.primary, // This will be handled in style array if we want absolute dynamicism, but for now we leave it as is or fix it
    },
    typeButtonText: {
        fontSize: 12,
        fontWeight: '500',
    },
    typeButtonActiveText: {
        color: 'white',
    },
    subToggleContainer: {
        flexDirection: 'row',
        borderRadius: 8,
        padding: 4,
    },
    subToggleButton: {
        flex: 1,
        paddingVertical: 5,
        alignItems: 'center',
        borderRadius: 6,
    },
    subToggleButtonActive: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    subToggleText: {
        fontSize: 12,
        fontWeight: '500',
    },
    subToggleTextActive: {
        fontWeight: 'bold',
    },
});
