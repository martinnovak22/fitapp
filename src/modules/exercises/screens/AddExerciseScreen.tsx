import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { ExerciseRepository, ExerciseType } from '@/src/db/exercises';
import { Button } from '@/src/modules/core/components/Button';
import { Card } from '@/src/modules/core/components/Card';
import { FullScreenImageModal } from '@/src/modules/core/components/FullScreenImageModal';
import { ScreenHeader } from '@/src/modules/core/components/ScreenHeader';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { Typography } from '@/src/modules/core/components/Typography';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

export default function AddExerciseScreen() {
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
            Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
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
        const docDir = (FileSystem as any).documentDirectory;
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
            Alert.alert('Required', 'Please enter an exercise name.');
            return;
        }

        setIsLoading(true);
        try {
            let finalPhotoUri = photoUri;
            const docDir = (FileSystem as any).documentDirectory;
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
        } catch (error) {
            console.error('Failed to save exercise:', error);
            Alert.alert('Error', 'Failed to save exercise.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Exercise',
            'Are you sure? This will not delete past workout data but will remove it from the list.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await ExerciseRepository.delete(Number(id));
                        router.dismissAll();
                        router.replace('/(tabs)/exercises');
                    }
                }
            ]
        );
    };

    return (
        <ScreenLayout>
            <ScreenHeader
                title={isEditing ? 'Edit Exercise' : 'Add Exercise'}
                onDelete={isEditing ? handleDelete : undefined}
            />
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                    <Animated.View layout={LinearTransition.duration(300)} style={{ padding: 16 }}>
                        <Typography.Subtitle style={{ marginBottom: 12 }}>Exercise Details</Typography.Subtitle>

                        <Typography.Label>Name</Typography.Label>
                        <TextInput
                            placeholder={"e.g. Bench Press"}
                            placeholderTextColor={Theme.textSecondary}
                            style={GlobalStyles.input}
                            value={name}
                            onChangeText={setName}
                            autoFocus={!isEditing}
                        />

                        <Typography.Label>Muscle Group</Typography.Label>
                        <TextInput
                            placeholder={"e.g. Chest"}
                            placeholderTextColor={Theme.textSecondary}
                            style={GlobalStyles.input}
                            value={muscle}
                            onChangeText={setMuscle}
                        />

                        <Typography.Subtitle style={{ marginTop: 16, marginBottom: 12 }}>Exercise Type</Typography.Subtitle>
                        <Animated.View layout={LinearTransition.duration(300)} style={styles.typeContainer}>
                            {[
                                { label: 'Weight', value: 'weight' as ExerciseType },
                                { label: 'Cardio', value: 'cardio' as ExerciseType },
                                { label: 'Bodyweight', value: 'bodyweight' as ExerciseType },
                            ].map((t) => {
                                const isActive = type === t.value || (t.value === 'bodyweight' && type === 'bodyweight_timer');
                                return (
                                    <TouchableOpacity
                                        key={t.value}
                                        style={[
                                            styles.typeButton,
                                            isActive && styles.typeButtonActive
                                        ]}
                                        onPress={() => setType(t.value)}
                                    >
                                        <Typography.Meta style={[
                                            styles.typeButtonText,
                                            isActive && styles.typeButtonActiveText
                                        ]}>
                                            {formatExerciseTypeCapitalized(t.label)}
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
                                <Typography.Label style={{ fontSize: 12, marginBottom: 6 }}>Tracking Mode</Typography.Label>
                                <View style={styles.subToggleContainer}>
                                    <TouchableOpacity
                                        style={[
                                            styles.subToggleButton,
                                            type === 'bodyweight' && styles.subToggleButtonActive
                                        ]}
                                        onPress={() => setType('bodyweight')}
                                    >
                                        <Typography.Meta style={[
                                            styles.subToggleText,
                                            type === 'bodyweight' && styles.subToggleTextActive
                                        ]}>Reps</Typography.Meta>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.subToggleButton,
                                            type === 'bodyweight_timer' && styles.subToggleButtonActive
                                        ]}
                                        onPress={() => setType('bodyweight_timer')}
                                    >
                                        <Typography.Meta style={[
                                            styles.subToggleText,
                                            type === 'bodyweight_timer' && styles.subToggleTextActive
                                        ]}>Timer</Typography.Meta>
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>
                        )}


                        <Animated.View entering={FadeIn} layout={LinearTransition} style={styles.photoSection}>
                            <Typography.Subtitle style={{ marginTop: 24, marginBottom: 12 }}>Exercise Photo</Typography.Subtitle>
                            {photoUri ? (
                                <TouchableOpacity style={styles.photoWrapper} onPress={() => setShowImageFullScreen(true)}>
                                    <Image key={photoUri} source={{ uri: photoUri }} style={styles.photo} />
                                    <TouchableOpacity
                                        style={styles.removePhotoButton}
                                        onPress={() => setPhotoUri(null)}
                                    >
                                        <FontAwesome name={"trash"} size={20} color={"#FF6B6B"} />
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={styles.addPhotoButton} onPress={handlePickImage}>
                                    <FontAwesome name={"camera"} size={30} color={Theme.primary} />
                                    <Typography.Meta style={styles.addPhotoText}>Add Photo</Typography.Meta>
                                </TouchableOpacity>
                            )}
                        </Animated.View>

                        <Animated.View layout={LinearTransition.duration(300)}>
                            <Button
                                label={isLoading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Exercise')}
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

// Simple helper since we are inside the file and don't want to over-import
const formatExerciseTypeCapitalized = (val: string) => val;

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
        borderColor: 'rgba(255,255,255,0.05)',
        borderStyle: 'dashed',
        backgroundColor: 'rgba(255,255,255,0.02)',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    addPhotoText: {
        color: Theme.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    photoWrapper: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
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
        backgroundColor: Theme.primary,
        borderColor: Theme.primary,
    },
    typeButtonText: {
        fontSize: 12,
        color: Theme.textSecondary,
        fontWeight: '500',
    },
    typeButtonActiveText: {
        color: 'white',
    },
    subToggleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
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
        color: Theme.textSecondary,
        fontSize: 12,
        fontWeight: '500',
    },
    subToggleTextActive: {
        color: Theme.text,
        fontWeight: 'bold',
    },
});
