import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import { Exercise } from '@/src/db/exercises';
import { SubSet } from '@/src/db/workouts';
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
            <View style={styles.centeredView}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                <Animated.View style={[styles.modalView, animatedStyle]}>
                    <Text style={GlobalStyles.title}>{editingSetId ? t('editSet') : t('inputSet')}</Text>

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
                                    <Animated.View layout={LinearTransition} style={styles.pyramidSection}>
                                        <View style={styles.pyramidHeader}>
                                            <TouchableOpacity
                                                onPress={() => setIsExpanded(!isExpanded)}
                                                style={styles.pyramidTitleContainer}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={styles.pyramidTitle}>
                                                    {t('pyramidSet')} {subSets.length > 0 ? `(${subSets.length})` : ''}
                                                </Text>
                                                <FontAwesome
                                                    name={isExpanded ? "chevron-up" : "chevron-down"}
                                                    size={10}
                                                    color={Theme.textSecondary}
                                                    style={{ marginLeft: 6, opacity: 0.5 }}
                                                />
                                            </TouchableOpacity>

                                            <TouchableOpacity style={styles.addDropButton} onPress={addSubSet}>
                                                <FontAwesome name="plus" size={10} color="white" />
                                            </TouchableOpacity>
                                        </View>

                                        {isExpanded && (
                                            <Animated.View entering={FadeIn.duration(200)} layout={LinearTransition} style={styles.pyramidScrollContainer}>
                                                <ScrollView
                                                    style={styles.pyramidScroll}
                                                    contentContainerStyle={subSets.length === 0 ? { flex: 1, justifyContent: 'center', alignItems: 'center' } : {}}
                                                    showsVerticalScrollIndicator
                                                    keyboardShouldPersistTaps="handled"
                                                >
                                                    {subSets.length === 0 ? (
                                                        <View style={styles.emptySubsets}>
                                                            <FontAwesome name="list" size={20} color={Theme.textSecondary} style={{ opacity: 0.2, marginBottom: 8 }} />
                                                            <Text style={styles.emptySubsetsText}>{t('noDropSets')}</Text>
                                                        </View>
                                                    ) : (
                                                        subSets.map((ss, idx) => (
                                                            <Animated.View key={idx} entering={FadeIn} layout={LinearTransition} style={styles.subSetRow}>
                                                                <View style={styles.subSetIndexContainer}>
                                                                    <Text style={styles.subSetIndex}>#{idx + 1}</Text>
                                                                </View>
                                                                <View style={styles.subSetInputGroup}>
                                                                    <TextInput
                                                                        style={styles.subSetInput}
                                                                        keyboardType="numeric"
                                                                        multiline={false}
                                                                        numberOfLines={1}
                                                                        placeholder={t('weight').toLowerCase()}
                                                                        placeholderTextColor={Theme.textSecondary}
                                                                        defaultValue={ss.weight && ss.weight > 0 ? ss.weight.toString() : ""}
                                                                        onChangeText={(v) => updateSubSet(idx, 'weight', v)}
                                                                        underlineColorAndroid="transparent"
                                                                    />
                                                                    <Text style={styles.subSetX}>×</Text>
                                                                    <TextInput
                                                                        style={styles.subSetInput}
                                                                        keyboardType="numeric"
                                                                        multiline={false}
                                                                        numberOfLines={1}
                                                                        placeholder={t('reps').toLowerCase()}
                                                                        placeholderTextColor={Theme.textSecondary}
                                                                        defaultValue={ss.reps && ss.reps > 0 ? ss.reps.toString() : ""}
                                                                        onChangeText={(v) => updateSubSet(idx, 'reps', v)}
                                                                        underlineColorAndroid="transparent"
                                                                    />
                                                                </View>
                                                                <TouchableOpacity onPress={() => removeSubSet(idx)} style={styles.removeSubSet}>
                                                                    <FontAwesome name="minus-circle" size={18} color={Theme.error} />
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
                            <Text style={styles.cancelText}>{t('cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onSave}
                            style={[styles.saveButton, !selectedExerciseId && styles.saveButtonDisabled]}
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
    return (
        <Animated.View layout={LinearTransition}>
            <Text style={GlobalStyles.subtitle}>{t('exerciseTitle')}</Text>
            <ScrollView style={styles.exerciseList} showsVerticalScrollIndicator>
                {exercises.map(ex => (
                    <TouchableOpacity
                        key={ex.id}
                        style={[styles.exerciseItem, selectedExerciseId === ex.id && styles.exerciseItemActive]}
                        onPress={() => {
                            setSelectedExerciseId(ex.id);
                            ['weight', 'reps', 'distance', 'durationMinutes', 'durationSeconds'].forEach(key => updateInput(key, ''));
                        }}
                    >
                        <Text style={[styles.exerciseItemText, selectedExerciseId === ex.id && styles.exerciseItemActiveText]}>{ex.name}</Text>
                        <Text style={[styles.exerciseItemSubtext, selectedExerciseId === ex.id && styles.exerciseItemActiveSubtext]}>
                            {formatExerciseType(ex.type)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </Animated.View>
    );
};

const SetInputFields = ({ selectedExercise, inputValues, updateInput }: { selectedExercise?: Exercise; inputValues: Props['inputValues']; updateInput: Props['updateInput'] }) => {
    const { t } = useTranslation();
    const type = selectedExercise?.type?.toLowerCase();

    return (
        <Animated.View layout={LinearTransition} style={[styles.dynamicFields, { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }]}>
            {type !== 'cardio' && (
                <View style={{ flex: 1, minWidth: type === 'bodyweight_timer' ? '100%' : '45%' }}>
                    <Text style={GlobalStyles.subtitle}>{t('weightKg')}</Text>
                    <TextInput
                        keyboardType='numeric'
                        multiline={false}
                        numberOfLines={1}
                        style={GlobalStyles.input}
                        value={inputValues.weight}
                        onChangeText={(t) => updateInput('weight', t)}
                        placeholder="0"
                        placeholderTextColor={Theme.textSecondary}
                        underlineColorAndroid="transparent"
                    />
                </View>
            )}

            {(type === 'weight' || type === 'bodyweight') && (
                <View style={{ flex: 1, minWidth: '45%' }}>
                    <Text style={GlobalStyles.subtitle}>{t('reps')}</Text>
                    <TextInput
                        keyboardType='numeric'
                        multiline={false}
                        numberOfLines={1}
                        style={GlobalStyles.input}
                        value={inputValues.reps}
                        onChangeText={(t) => updateInput('reps', t)}
                        placeholder="0"
                        placeholderTextColor={Theme.textSecondary}
                        underlineColorAndroid="transparent"
                    />
                </View>
            )}

            {type === 'cardio' && (
                <View style={{ flex: 1, minWidth: '100%' }}>
                    <Text style={GlobalStyles.subtitle}>{t('distM')}</Text>
                    <TextInput
                        keyboardType='numeric'
                        multiline={false}
                        numberOfLines={1}
                        style={GlobalStyles.input}
                        value={inputValues.distance}
                        onChangeText={(t) => updateInput('distance', t)}
                        placeholder="0"
                        placeholderTextColor={Theme.textSecondary}
                        underlineColorAndroid="transparent"
                    />
                </View>
            )}

            {(type === 'cardio' || type === 'bodyweight_timer') && (
                <Animated.View layout={LinearTransition} entering={FadeIn} style={{ flex: 2, flexDirection: 'row', gap: 10, minWidth: type === 'cardio' ? '65%' : '100%' }}>
                    <View style={{ flex: 1 }}>
                        <Text style={GlobalStyles.subtitle}>{t('minutes')}</Text>
                        <TextInput
                            keyboardType='numeric'
                            multiline={false}
                            numberOfLines={1}
                            style={GlobalStyles.input}
                            value={inputValues.durationMinutes}
                            onChangeText={(t) => updateInput('durationMinutes', t)}
                            placeholder="00"
                            placeholderTextColor={Theme.textSecondary}
                            underlineColorAndroid="transparent"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={GlobalStyles.subtitle}>{t('seconds')}</Text>
                        <TextInput
                            keyboardType='numeric'
                            multiline={false}
                            numberOfLines={1}
                            style={GlobalStyles.input}
                            value={inputValues.durationSeconds}
                            onChangeText={(t) => updateInput('durationSeconds', t)}
                            placeholder="00"
                            placeholderTextColor={Theme.textSecondary}
                            underlineColorAndroid="transparent"
                        />
                    </View>
                </Animated.View>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.85)'
    },
    modalView: {
        width: '90%',
        maxHeight: DEVICE_HEIGHT * 0.85,
        backgroundColor: Theme.surface,
        borderRadius: 20,
        padding: 24,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    contentContainer: {
        marginTop: 10,
    },
    exerciseList: {
        height: 120,
        marginBottom: 16,
        backgroundColor: Theme.background,
        borderRadius: 8,
    },
    exerciseItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: Theme.border + '20',
    },
    exerciseItemActive: {
        backgroundColor: Theme.primary,
    },
    exerciseItemText: {
        color: Theme.text,
        fontWeight: '600',
    },
    exerciseItemActiveText: {
        color: 'white',
    },
    exerciseItemSubtext: {
        color: Theme.textSecondary,
        fontSize: 8,
        marginTop: 2,
    },
    exerciseItemActiveSubtext: {
        color: 'rgba(255,255,255,0.7)',
    },
    inputsSection: {
        marginTop: 16,
    },
    dynamicFields: {
        flexDirection: 'column',
    },
    pyramidSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    pyramidHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    pyramidTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },
    pyramidTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: Theme.textSecondary,
        textTransform: 'uppercase',
    },
    addDropButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: Theme.primary,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    pyramidScrollContainer: {
        overflow: 'hidden',
    },
    pyramidScroll: {
        height: 120,
        backgroundColor: Theme.background,
        borderRadius: 8,
    },
    emptySubsets: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    emptySubsetsText: {
        color: Theme.textSecondary,
        fontSize: 10,
        fontWeight: '600',
        opacity: 0.5,
    },
    subSetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        gap: 12,
    },
    subSetIndexContainer: {
        width: 24,
    },
    subSetIndex: {
        fontSize: 10,
        fontWeight: 'bold',
        color: Theme.textSecondary,
        opacity: 0.6,
    },
    subSetInputGroup: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    subSetInput: {
        flex: 1,
        color: Theme.text,
        height: 32,
        borderRadius: 4,
        textAlign: 'center',
        fontSize: 13,
        fontWeight: '600',
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingVertical: 0,
        includeFontPadding: false,
    },
    subSetX: {
        fontSize: 12,
        color: Theme.textSecondary,
        opacity: 0.4,
    },
    removeSubSet: {
        padding: 4,
        opacity: 0.8,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 16,
        gap: 10,
    },
    cancelButton: {
        padding: 10,
        marginRight: 10,
    },
    cancelText: {
        color: Theme.error,
    },
    saveButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: Theme.primary,
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
