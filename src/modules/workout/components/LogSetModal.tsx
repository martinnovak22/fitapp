import { Spacing } from '@/src/constants/Spacing';
import { GlobalStyles } from '@/src/constants/Styles';
import { Exercise } from '@/src/db/exercises';
import { SubSet } from '@/src/db/workouts';
import { Typography } from '@/src/modules/core/components/Typography';
import { useTheme } from '@/src/modules/core/hooks/useTheme';
import { formatExerciseType } from '@/src/utils/formatters';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, Keyboard, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SetFormValues } from '../setPayload';

const { height: DEVICE_HEIGHT } = Dimensions.get('window');
const EXERCISE_LIST_MAX_HEIGHT = Math.min(180, Math.floor(DEVICE_HEIGHT * 0.22));
const PYRAMID_LIST_MAX_HEIGHT = Math.min(160, Math.floor(DEVICE_HEIGHT * 0.2));

type Props = {
    visible: boolean;
    onClose: () => void;
    onSave: () => void;
    editingSetId: number | null;
    exercises: Exercise[];
    selectedExerciseId: number | null;
    setSelectedExerciseId: (id: number) => void;
    subSets: SubSet[];
    setSubSets: React.Dispatch<React.SetStateAction<SubSet[]>>;
    inputValues: SetFormValues;
    updateInput: (key: keyof SetFormValues, value: string) => void;
    isSaving: boolean;
};

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
    const { t } = useTranslation();
    const { theme } = useTheme();

    const selectedExercise = exercises.find(e => e.id === selectedExerciseId);
    const [isExpanded, setIsExpanded] = React.useState(false);

    const keyboardHeight = useSharedValue(0);
    const modalOpacity = useSharedValue(0);

    React.useEffect(() => {
        if (visible) {
            modalOpacity.value = 0;
            modalOpacity.value = withTiming(1, { duration: 180 });
            if (subSets.length > 0) setIsExpanded(true);
            return;
        }

        // Closing should be immediate, no fade-out animation.
        modalOpacity.value = 0;
        keyboardHeight.value = 0;
        setIsExpanded(false);
    }, [keyboardHeight, modalOpacity, subSets.length, visible]);

    React.useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, (event) => {
            keyboardHeight.value = withTiming(event.endCoordinates.height, { duration: 150 });
        });
        const hideSub = Keyboard.addListener(hideEvent, () => {
            keyboardHeight.value = withTiming(0, { duration: 150 });
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [keyboardHeight]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: modalOpacity.value,
        transform: [{ translateY: -keyboardHeight.value / 2 }],
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
        <Modal animationType={'none'} transparent visible={visible} onRequestClose={onClose}>
            <View style={[styles.centeredView, { backgroundColor: theme.overlayBackdrop }]}> 
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

                <Animated.View style={[styles.modalView, { backgroundColor: theme.surface }, animatedStyle]}>
                    <Text style={[GlobalStyles.title, { color: theme.text }]}>{editingSetId ? t('editSet') : t('inputSet')}</Text>

                    <Animated.View layout={LinearTransition.duration(220)} style={styles.contentContainer}>
                        {!editingSetId && (
                            <ExercisePicker
                                exercises={exercises}
                                selectedExerciseId={selectedExerciseId}
                                setSelectedExerciseId={setSelectedExerciseId}
                                updateInput={updateInput}
                                visible={visible}
                            />
                        )}

                        {selectedExercise && (
                            <Animated.View layout={LinearTransition.duration(220)} style={styles.inputsSection}>
                                <SetInputFields
                                    selectedExercise={selectedExercise}
                                    inputValues={inputValues}
                                    updateInput={updateInput}
                                />

                                {selectedExercise.type === 'weight' && (
                                    <Animated.View layout={LinearTransition.duration(220)} style={[styles.pyramidSection, { borderTopColor: theme.inputBackground }]}> 
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
                                                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                                    size={10}
                                                    color={theme.textSecondary}
                                                    style={styles.pyramidChevron}
                                                />
                                            </TouchableOpacity>

                                            <TouchableOpacity style={[styles.addDropButton, { backgroundColor: theme.primary }]} onPress={addSubSet}>
                                                <FontAwesome name={'plus'} size={10} color={theme.onPrimary} />
                                            </TouchableOpacity>
                                        </View>

                                        {isExpanded && (
                                            <Animated.View layout={LinearTransition.duration(220)} style={styles.pyramidScrollContainer}>
                                                <ScrollView
                                                    style={[styles.pyramidScroll, { backgroundColor: theme.background }]}
                                                    contentContainerStyle={subSets.length === 0 ? styles.emptySubsetsContainer : undefined}
                                                    showsVerticalScrollIndicator
                                                    keyboardShouldPersistTaps={'handled'}
                                                >
                                                    {subSets.length === 0 ? (
                                                        <View style={styles.emptySubsets}>
                                                            <FontAwesome name={'list'} size={20} color={theme.textSecondary} style={styles.emptySubsetsIcon} />
                                                            <Text style={[styles.emptySubsetsText, { color: theme.textSecondary }]}>{t('noDropSets')}</Text>
                                                        </View>
                                                    ) : (
                                                        subSets.map((ss, idx) => (
                                                            <View key={idx} style={[styles.subSetRow, { borderBottomColor: theme.inputBackground }]}> 
                                                                <View style={styles.subSetIndexContainer}>
                                                                    <Text style={[styles.subSetIndex, { color: theme.textSecondary }]}>#{idx + 1}</Text>
                                                                </View>

                                                                <View style={styles.subSetInputGroup}>
                                                                    <TextInput
                                                                        style={[styles.subSetInput, { color: theme.text, backgroundColor: theme.inputBackground }]}
                                                                        keyboardType={'numeric'}
                                                                        multiline={false}
                                                                        numberOfLines={1}
                                                                        placeholder={t('weight').toLowerCase()}
                                                                        placeholderTextColor={theme.textSecondary}
                                                                        defaultValue={ss.weight && ss.weight > 0 ? ss.weight.toString() : ''}
                                                                        onChangeText={(value) => updateSubSet(idx, 'weight', value)}
                                                                        underlineColorAndroid={'transparent'}
                                                                        selectionColor={theme.primary}
                                                                        scrollEnabled={false}
                                                                        returnKeyType={'next'}
                                                                        accessibilityLabel={`${t('drop')} ${idx + 1} ${t('weight')}`}
                                                                    />
                                                                    <Text style={[styles.subSetX, { color: theme.textSecondary }]}>×</Text>
                                                                    <TextInput
                                                                        style={[styles.subSetInput, { color: theme.text, backgroundColor: theme.inputBackground }]}
                                                                        keyboardType={'numeric'}
                                                                        multiline={false}
                                                                        numberOfLines={1}
                                                                        placeholder={t('reps').toLowerCase()}
                                                                        placeholderTextColor={theme.textSecondary}
                                                                        defaultValue={ss.reps && ss.reps > 0 ? ss.reps.toString() : ''}
                                                                        onChangeText={(value) => updateSubSet(idx, 'reps', value)}
                                                                        underlineColorAndroid={'transparent'}
                                                                        selectionColor={theme.primary}
                                                                        scrollEnabled={false}
                                                                        returnKeyType={'done'}
                                                                        accessibilityLabel={`${t('drop')} ${idx + 1} ${t('reps')}`}
                                                                    />
                                                                </View>

                                                                <TouchableOpacity onPress={() => removeSubSet(idx)} style={styles.removeSubSet}>
                                                                    <FontAwesome name={'minus-circle'} size={18} color={theme.error} />
                                                                </TouchableOpacity>
                                                            </View>
                                                        ))
                                                    )}
                                                </ScrollView>
                                            </Animated.View>
                                        )}
                                    </Animated.View>
                                )}
                            </Animated.View>
                        )}
                    </Animated.View>

                    <View style={styles.footerHintRow}>
                        <Text
                            style={[styles.footerHintText, { color: !selectedExerciseId ? theme.error : 'transparent' }]}
                            numberOfLines={1}
                            accessibilityLiveRegion={'polite'}
                        >
                            {!selectedExerciseId ? t('selectExerciseFirst') : ' '}
                        </Text>
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
                            <Text style={[styles.cancelText, { color: theme.error }]}>{t('cancel')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onSave}
                            style={[styles.saveButton, { backgroundColor: theme.primary }, (!selectedExerciseId || isSaving) && styles.saveButtonDisabled]}
                            disabled={!selectedExerciseId || isSaving}
                            accessibilityRole={'button'}
                            accessibilityLabel={editingSetId ? t('update') : t('addSet')}
                            accessibilityState={{ disabled: !selectedExerciseId || isSaving }}
                        >
                            {isSaving ? (
                                <View style={styles.saveLoadingRow}>
                                    <ActivityIndicator size={'small'} color={theme.onPrimary} />
                                    <Text style={styles.saveText}>{t('saving')}</Text>
                                </View>
                            ) : (
                                <Text style={styles.saveText}>{editingSetId ? t('update') : t('addSet')}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const ExercisePicker = ({ exercises, selectedExerciseId, setSelectedExerciseId, updateInput, visible }: Pick<Props, 'exercises' | 'selectedExerciseId' | 'setSelectedExerciseId' | 'updateInput' | 'visible'>) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const scrollRef = React.useRef<ScrollView | null>(null);
    const itemPositionsRef = React.useRef<Record<number, number>>({});
    const didAutoScrollOnOpenRef = React.useRef(false);

    React.useEffect(() => {
        if (!visible) {
            didAutoScrollOnOpenRef.current = false;
            return;
        }

        if (didAutoScrollOnOpenRef.current || !selectedExerciseId) return;

        const selectedY = itemPositionsRef.current[selectedExerciseId];
        if (typeof selectedY !== 'number') return;

        didAutoScrollOnOpenRef.current = true;
        const frame = requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ y: Math.max(0, selectedY - Spacing.sm), animated: false });
        });

        return () => cancelAnimationFrame(frame);
    }, [exercises.length, selectedExerciseId, visible]);

    return (
        <View>
            <Typography.Subtitle>{t('exerciseTitle')}</Typography.Subtitle>
            <ScrollView ref={scrollRef} style={[styles.exerciseList, { backgroundColor: theme.background }]} showsVerticalScrollIndicator>
                {exercises.map(exercise => (
                    <TouchableOpacity
                        key={exercise.id}
                        onLayout={(event) => {
                            itemPositionsRef.current[exercise.id] = event.nativeEvent.layout.y;
                        }}
                        style={[
                            styles.exerciseItem,
                            { borderBottomColor: `${theme.border}20` },
                            selectedExerciseId === exercise.id && [styles.exerciseItemActive, { backgroundColor: theme.primary }],
                        ]}
                        onPress={() => {
                            setSelectedExerciseId(exercise.id);
                            const fields = ['weight', 'reps', 'distance', 'durationMinutes', 'durationSeconds'] as const;
                            fields.forEach(key => updateInput(key, ''));
                        }}
                    >
                        <Text style={[styles.exerciseItemText, { color: theme.text }, selectedExerciseId === exercise.id && styles.exerciseItemActiveText]}>{exercise.name}</Text>
                        <Text style={[styles.exerciseItemSubtext, { color: theme.textSecondary }, selectedExerciseId === exercise.id && styles.exerciseItemActiveSubtext]}>
                            {t(formatExerciseType(exercise.type))}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const SetInputFields = ({ selectedExercise, inputValues, updateInput }: { selectedExercise?: Exercise; inputValues: Props['inputValues']; updateInput: Props['updateInput'] }) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const type = selectedExercise?.type?.toLowerCase();

    return (
        <View style={styles.dynamicFields}>
            {type !== 'cardio' && (
                <View style={[styles.fieldCell, { minWidth: type === 'bodyweight_timer' ? '100%' : '45%' }]}>
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
                </View>
            )}

            {(type === 'weight' || type === 'bodyweight') && (
                <View style={styles.fieldCell}>
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
                </View>
            )}

            {type === 'cardio' && (
                <View style={[styles.fieldCell, styles.fieldFull]}>
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
                </View>
            )}

            {(type === 'cardio' || type === 'bodyweight_timer') && (
                <View style={[styles.durationRow, { minWidth: type === 'cardio' ? '65%' : '100%' }]}>
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
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalView: {
        width: '90%',
        maxHeight: DEVICE_HEIGHT * 0.86,
        borderRadius: 20,
        padding: Spacing.lg,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    contentContainer: {
        marginTop: Spacing.sm,
        flexShrink: 1,
    },
    exerciseList: {
        minHeight: 96,
        maxHeight: EXERCISE_LIST_MAX_HEIGHT,
        marginBottom: Spacing.md,
        borderRadius: 8,
    },
    exerciseItem: {
        padding: Spacing.md,
        borderBottomWidth: 1,
    },
    exerciseItemActive: {},
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
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    fieldCell: {
        flex: 1,
        minWidth: '45%',
    },
    fieldFull: {
        minWidth: '100%',
    },
    durationRow: {
        flex: 2,
        flexDirection: 'row',
        gap: 10,
    },
    durationCell: {
        flex: 1,
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
    pyramidChevron: {
        marginLeft: 6,
        opacity: 0.5,
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
        minHeight: 96,
        maxHeight: PYRAMID_LIST_MAX_HEIGHT,
        borderRadius: 8,
    },
    emptySubsetsContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
        gap: Spacing.sm,
    },
    footerHintRow: {
        minHeight: 18,
        marginTop: Spacing.md,
        marginBottom: Spacing.xs,
        justifyContent: 'center',
    },
    footerHintText: {
        fontSize: 12,
        fontWeight: '600',
    },
    cancelButton: {
        padding: Spacing.sm,
        marginRight: Spacing.sm,
    },
    cancelText: {},
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
    },
    saveLoadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
});
