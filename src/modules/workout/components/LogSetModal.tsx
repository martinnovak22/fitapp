import { Spacing } from '@/src/constants/Spacing';
import { GlobalStyles } from '@/src/constants/Styles';
import { Typography } from '@/src/modules/core/components/Typography';

import { Exercise } from '@/src/db/exercises';
import { SubSet } from '@/src/db/workouts';
import { useTheme } from '@/src/modules/core/hooks/useTheme';
import { formatExerciseType } from '@/src/utils/formatters';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Keyboard, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';


const { height: DEVICE_HEIGHT } = Dimensions.get('window');

interface Props {
    visible: boolean;
    onClose: () => void;
    onSave: () => void;
    editingSetId: number | null;
    exercises: Exercise[];
    selectedExerciseId: number | null;
    setSelectedExerciseId: (id: number) => void;
    subSets: SubSet[];
    setSubSets: React.Dispatch<React.SetStateAction<SubSet[]>>;
    inputValues: {
        weight: string;
        reps: string;
        distance: string;
        durationMinutes: string;
        durationSeconds: string;
    };
    updateInput: (key: string, value: string) => void;
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
    updateInput
}: Props) => {
    const { t } = useTranslation();
    const { theme } = useTheme();

    const selectedExercise = exercises.find(e => e.id === selectedExerciseId);
    const [isExpanded, setIsExpanded] = React.useState(false);


    const keyboardHeight = useSharedValue(0);
    const modalOpacity = useSharedValue(0);
    const modalScale = useSharedValue(0.95);

    React.useEffect(() => {
        if (visible) {
            modalOpacity.value = withTiming(1, { duration: 150 });
            modalScale.value = withTiming(1, { duration: 150 });
            if (subSets.length > 0) setIsExpanded(true);
        } else {
            modalOpacity.value = 0;
            modalScale.value = 0.95;
            keyboardHeight.value = 0;
            setIsExpanded(false);
        }
    }, [visible, subSets.length]);

    React.useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, (e) => {
            keyboardHeight.value = withTiming(e.endCoordinates.height, { duration: 150 });
        });
        const hideSub = Keyboard.addListener(hideEvent, () => {
            keyboardHeight.value = withTiming(0, { duration: 150 });
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: modalOpacity.value,
        transform: [
            { translateY: -keyboardHeight.value / 1.7 },
            { scale: modalScale.value }
        ],
    }));

    const addSubSet = () => {
        setSubSets(prev => [...prev, { weight: 0, reps: 0 }]);
        setIsExpanded(true);
    };

    const updateSubSet = (index: number, field: keyof SubSet, value: string) => {
        const num = parseFloat(value.replace(',', '.')) || 0;
        setSubSets(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: num };
            return next;
        });
    };

    const removeSubSet = (index: number) => {
        setSubSets(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
            <View style={[styles.centeredView, { backgroundColor: theme.overlayBackdrop }]}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                <Animated.View style={[styles.modalView, { backgroundColor: theme.surface }, animatedStyle]}>
                    <Text style={[GlobalStyles.title, { color: theme.text }]}>{editingSetId ? t('editSet') : t('inputSet')}</Text>


                    <View style={styles.contentContainer}>
                        {!editingSetId && (
                            <ExercisePicker
                                exercises={exercises}
                                selectedExerciseId={selectedExerciseId}
                                setSelectedExerciseId={setSelectedExerciseId}
                                updateInput={updateInput}
                            />
                        )}

                        {selectedExercise && (
                            <View style={styles.inputsSection}>
                                <SetInputFields
                                    selectedExercise={selectedExercise}
                                    inputValues={inputValues}
                                    updateInput={updateInput}
                                />

                                {selectedExercise.type === 'weight' && (
                                    <Animated.View layout={LinearTransition} style={[styles.pyramidSection, { borderTopColor: theme.inputBackground }]}>

                                        <View style={styles.pyramidHeader}>
                                            <TouchableOpacity
                                                onPress={() => setIsExpanded(!isExpanded)}
                                                style={styles.pyramidTitleContainer}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={[styles.pyramidTitle, { color: theme.textSecondary }]}>
                                                    {t('pyramidSet')} {subSets.length > 0 ? `(${subSets.length})` : ''}
                                                </Text>
                                                <FontAwesome
                                                    name={isExpanded ? "chevron-up" : "chevron-down"}
                                                    size={10}
                                                    color={theme.textSecondary}
                                                    style={{ marginLeft: 6, opacity: 0.5 }}
                                                />
                                            </TouchableOpacity>

                                            <TouchableOpacity style={[styles.addDropButton, { backgroundColor: theme.primary }]} onPress={addSubSet}>
                                                <FontAwesome name={"plus"} size={10} color={theme.onPrimary} />
                                            </TouchableOpacity>


                                        </View>

                                        {isExpanded && (
                                            <Animated.View entering={FadeIn.duration(200)} layout={LinearTransition} style={styles.pyramidScrollContainer}>
                                                <ScrollView
                                                    style={[styles.pyramidScroll, { backgroundColor: theme.background }]}
                                                    contentContainerStyle={subSets.length === 0 ? { flex: 1, justifyContent: 'center', alignItems: 'center' } : {}}
                                                    showsVerticalScrollIndicator
                                                    keyboardShouldPersistTaps="handled"
                                                >

                                                    {subSets.length === 0 ? (
                                                        <View style={styles.emptySubsets}>
                                                            <FontAwesome name={"list"} size={20} color={theme.textSecondary} style={{ opacity: 0.2, marginBottom: 8 }} />
                                                            <Text style={[styles.emptySubsetsText, { color: theme.textSecondary }]}>{t('noDropSets')}</Text>
                                                        </View>


                                                    ) : (
                                                        subSets.map((ss, idx) => (
                                                            <Animated.View key={idx} entering={FadeIn} layout={LinearTransition} style={[styles.subSetRow, { borderBottomColor: theme.inputBackground }]}>
                                                                <View style={styles.subSetIndexContainer}>
                                                                    <Text style={[styles.subSetIndex, { color: theme.textSecondary }]}>#{idx + 1}</Text>
                                                                </View>

                                                                <View style={styles.subSetInputGroup}>
                                                                    <TextInput
                                                                        style={[styles.subSetInput, { color: theme.text, backgroundColor: theme.inputBackground }]}
                                                                        keyboardType="numeric"
                                                                        multiline={false}
                                                                        numberOfLines={1}
                                                                        placeholder={t('weight').toLowerCase()}
                                                                        placeholderTextColor={theme.textSecondary}
                                                                        defaultValue={ss.weight && ss.weight > 0 ? ss.weight.toString() : ""}
                                                                        onChangeText={(v) => updateSubSet(idx, 'weight', v)}
                                                                        underlineColorAndroid="transparent"
                                                                        selectionColor={theme.primary}
                                                                        scrollEnabled={false}
                                                                    />
                                                                    <Text style={[styles.subSetX, { color: theme.textSecondary }]}>×</Text>
                                                                    <TextInput
                                                                        style={[styles.subSetInput, { color: theme.text, backgroundColor: theme.inputBackground }]}
                                                                        keyboardType="numeric"
                                                                        multiline={false}
                                                                        numberOfLines={1}
                                                                        placeholder={t('reps').toLowerCase()}
                                                                        placeholderTextColor={theme.textSecondary}
                                                                        defaultValue={ss.reps && ss.reps > 0 ? ss.reps.toString() : ""}
                                                                        onChangeText={(v) => updateSubSet(idx, 'reps', v)}
                                                                        underlineColorAndroid="transparent"
                                                                        selectionColor={theme.primary}
                                                                        scrollEnabled={false}
                                                                    />

                                                                </View>
                                                                <TouchableOpacity onPress={() => removeSubSet(idx)} style={styles.removeSubSet}>
                                                                    <FontAwesome name={"minus-circle"} size={18} color={theme.error} />
                                                                </TouchableOpacity>


                                                            </Animated.View>
                                                        ))
                                                    )}
                                                </ScrollView>
                                            </Animated.View>
                                        )}
                                    </Animated.View>
                                )}
                            </View>
                        )}
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
                            <Text style={[styles.cancelText, { color: theme.error }]}>{t('cancel')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onSave}
                            style={[styles.saveButton, { backgroundColor: theme.primary }, !selectedExerciseId && styles.saveButtonDisabled]}
                            disabled={!selectedExerciseId}
                        >
                            <Text style={styles.saveText}>{editingSetId ? t('update') : t('addSet')}</Text>
                        </TouchableOpacity>

                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

// Helper Components
const ExercisePicker = ({ exercises, selectedExerciseId, setSelectedExerciseId, updateInput }: Pick<Props, 'exercises' | 'selectedExerciseId' | 'setSelectedExerciseId' | 'updateInput'>) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    return (
        <Animated.View layout={LinearTransition}>
            <Typography.Subtitle>{t('exerciseTitle')}</Typography.Subtitle>
            <ScrollView style={[styles.exerciseList, { backgroundColor: theme.background }]} showsVerticalScrollIndicator>
                {exercises.map(ex => (
                    <TouchableOpacity
                        key={ex.id}
                        style={[
                            styles.exerciseItem,
                            { borderBottomColor: theme.border + '20' },
                            selectedExerciseId === ex.id && [styles.exerciseItemActive, { backgroundColor: theme.primary }]
                        ]}
                        onPress={() => {
                            setSelectedExerciseId(ex.id);
                            ['weight', 'reps', 'distance', 'durationMinutes', 'durationSeconds'].forEach(key => updateInput(key, ''));
                        }}
                    >
                        <Text style={[styles.exerciseItemText, { color: theme.text }, selectedExerciseId === ex.id && styles.exerciseItemActiveText]}>{ex.name}</Text>
                        <Text style={[styles.exerciseItemSubtext, { color: theme.textSecondary }, selectedExerciseId === ex.id && styles.exerciseItemActiveSubtext]}>
                            {t(formatExerciseType(ex.type))}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </Animated.View>
    );
};


const SetInputFields = ({ selectedExercise, inputValues, updateInput }: { selectedExercise?: Exercise; inputValues: Props['inputValues']; updateInput: Props['updateInput'] }) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const type = selectedExercise?.type?.toLowerCase();

    return (
        <Animated.View layout={LinearTransition} style={[styles.dynamicFields, { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }]}>
            {type !== 'cardio' && (
                <View style={{ flex: 1, minWidth: type === 'bodyweight_timer' ? '100%' : '45%' }}>
                    <Typography.Subtitle>{t('weightKg')}</Typography.Subtitle>
                    <TextInput
                        keyboardType='numeric'
                        multiline={false}
                        numberOfLines={1}
                        style={[GlobalStyles.input, { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.border }]}
                        value={inputValues.weight}
                        onChangeText={(t) => updateInput('weight', t)}
                        placeholder="0"
                        placeholderTextColor={theme.textSecondary}
                        underlineColorAndroid="transparent"
                        selectionColor={theme.primary}
                        scrollEnabled={false}
                    />
                </View>
            )}

            {(type === 'weight' || type === 'bodyweight') && (
                <View style={{ flex: 1, minWidth: '45%' }}>
                    <Typography.Subtitle>{t('reps')}</Typography.Subtitle>
                    <TextInput
                        keyboardType='numeric'
                        multiline={false}
                        numberOfLines={1}
                        style={[GlobalStyles.input, { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.border }]}
                        value={inputValues.reps}
                        onChangeText={(t) => updateInput('reps', t)}
                        placeholder="0"
                        placeholderTextColor={theme.textSecondary}
                        underlineColorAndroid="transparent"
                        selectionColor={theme.primary}
                        scrollEnabled={false}
                    />
                </View>
            )}

            {type === 'cardio' && (
                <View style={{ flex: 1, minWidth: '100%' }}>
                    <Typography.Subtitle>{t('distM')}</Typography.Subtitle>
                    <TextInput
                        keyboardType='numeric'
                        multiline={false}
                        numberOfLines={1}
                        style={[GlobalStyles.input, { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.border }]}
                        value={inputValues.distance}
                        onChangeText={(t) => updateInput('distance', t)}
                        placeholder="0"
                        placeholderTextColor={theme.textSecondary}
                        underlineColorAndroid="transparent"
                        selectionColor={theme.primary}
                        scrollEnabled={false}
                    />
                </View>
            )}

            {(type === 'cardio' || type === 'bodyweight_timer') && (
                <Animated.View layout={LinearTransition} entering={FadeIn} style={{ flex: 2, flexDirection: 'row', gap: 10, minWidth: type === 'cardio' ? '65%' : '100%' }}>
                    <View style={{ flex: 1 }}>
                        <Typography.Subtitle>{t('minutes')}</Typography.Subtitle>
                        <TextInput
                            keyboardType='numeric'
                            multiline={false}
                            numberOfLines={1}
                            style={[GlobalStyles.input, { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.border }]}
                            value={inputValues.durationMinutes}
                            onChangeText={(t) => updateInput('durationMinutes', t)}
                            placeholder="00"
                            placeholderTextColor={theme.textSecondary}
                            underlineColorAndroid="transparent"
                            selectionColor={theme.primary}
                            scrollEnabled={false}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Typography.Subtitle>{t('seconds')}</Typography.Subtitle>
                        <TextInput
                            keyboardType='numeric'
                            multiline={false}
                            numberOfLines={1}
                            style={[GlobalStyles.input, { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.border }]}
                            value={inputValues.durationSeconds}
                            onChangeText={(t) => updateInput('durationSeconds', t)}
                            placeholder="00"
                            placeholderTextColor={theme.textSecondary}
                            underlineColorAndroid="transparent"
                            selectionColor={theme.primary}
                            scrollEnabled={false}
                        />
                    </View>
                </Animated.View>
            )}
        </Animated.View>
    );
};


/* Styles */
const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalView: {
        width: '90%',
        maxHeight: DEVICE_HEIGHT * 0.85,
        borderRadius: 20,
        padding: Spacing.lg,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },

    contentContainer: {
        marginTop: Spacing.sm,
    },
    exerciseList: {
        height: 120,
        marginBottom: Spacing.md,
        borderRadius: 8,
    },

    exerciseItem: {
        padding: Spacing.md,
        borderBottomWidth: 1,
    },

    exerciseItemActive: {
    },

    exerciseItemText: {
        fontWeight: '600',
    },

    exerciseItemActiveText: {
        color: 'white',
    },
    exerciseItemSubtext: {
        fontSize: 8,
        marginTop: Spacing.xs,
    },

    exerciseItemActiveSubtext: {
        color: 'rgba(255,255,255,0.7)',
    },
    inputsSection: {
        marginTop: Spacing.md,
    },
    dynamicFields: {
        flexDirection: 'column',
    },
    pyramidSection: {
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
    },
    pyramidHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    pyramidTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.xs,
    },
    pyramidTitle: {
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
    },

    addDropButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: 6,
    },

    pyramidScrollContainer: {
        overflow: 'hidden',
    },
    pyramidScroll: {
        height: 120,
        borderRadius: 8,
    },

    emptySubsets: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    emptySubsetsText: {
        fontSize: 10,
        fontWeight: '600',
        opacity: 0.5,
    },

    subSetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderBottomWidth: 1,
        gap: Spacing.md,
    },
    subSetIndexContainer: {
        width: 24,
    },
    subSetIndex: {
        fontSize: 10,
        fontWeight: 'bold',
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
        height: 32,
        borderRadius: 4,
        textAlign: 'center',
        fontSize: 13,
        fontWeight: '600',
        paddingVertical: 0,
        includeFontPadding: false,
    },

    subSetX: {
        fontSize: 12,
        opacity: 0.4,
    },

    removeSubSet: {
        padding: Spacing.xs,
    },

    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: Spacing.md,
        gap: Spacing.sm,
    },
    cancelButton: {
        padding: Spacing.sm,
        marginRight: Spacing.sm,
    },
    cancelText: {
    },

    saveButton: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        borderRadius: 8,
    },

    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveText: {
        color: 'white',
        fontWeight: 'bold',
    }
});
