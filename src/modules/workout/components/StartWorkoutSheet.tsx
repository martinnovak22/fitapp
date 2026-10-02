import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import type { WorkoutTemplate } from '@/src/db/workoutTemplates'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { TemplateRow } from '@/src/modules/templates/components/TemplateRow'
import type { TemplateSummary } from '@/src/modules/templates/templateSummary'

type Props = {
    visible: boolean
    templates: TemplateSummary[]
    isStarting: boolean
    onClose: () => void
    onStartUnplanned: () => void
    onStartPlanned: (template: WorkoutTemplate) => void
    onCreateTemplate: () => void
}

// The fork at the start of every Workout: Unplanned (pick from every Exercise,
// the original behaviour) or Planned from one of the user's Workout Templates.
export function StartWorkoutSheet({
    visible,
    templates,
    isStarting,
    onClose,
    onStartUnplanned,
    onStartPlanned,
    onCreateTemplate,
}: Props) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const insets = useSafeAreaInsets()

    return (
        <Modal visible={visible} transparent animationType={'fade'} onRequestClose={onClose} statusBarTranslucent>
            <Pressable style={[styles.backdrop, { backgroundColor: theme.overlayScrim }]} onPress={onClose}>
                <Pressable
                    style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.lg }]}
                    onPress={() => {}}
                >
                    <View style={styles.grabberWrap}>
                        <View style={[styles.grabber, { backgroundColor: `${theme.textSecondary}66` }]} />
                    </View>
                    <Typography.Subtitle style={styles.title}>{t('startWorkoutTitle')}</Typography.Subtitle>

                    <TouchableOpacity
                        onPress={onStartUnplanned}
                        disabled={isStarting}
                        activeOpacity={0.7}
                        style={[
                            styles.unplanned,
                            { borderColor: theme.border, backgroundColor: theme.surfaceSubtle },
                            isStarting && styles.disabled,
                        ]}
                        accessibilityRole={'button'}
                        accessibilityLabel={t('unplannedWorkout')}
                        accessibilityHint={t('unplannedWorkoutHint')}
                    >
                        <View style={[styles.icon, { backgroundColor: theme.surfaceMuted }]}>
                            <FontAwesome name={'bolt'} size={16} color={theme.text} />
                        </View>
                        <View style={styles.text}>
                            <Typography.Body weight={'semibold'}>{t('unplannedWorkout')}</Typography.Body>
                            <Typography.Meta color={'textSecondary'}>{t('unplannedWorkoutHint')}</Typography.Meta>
                        </View>
                        <FontAwesome name={'play'} size={14} color={theme.textSecondary} />
                    </TouchableOpacity>

                    <View style={styles.sectionHeader}>
                        <Typography.Meta weight={'bold'} color={'textSecondary'} style={styles.sectionLabel}>
                            {t('fromPlan')}
                        </Typography.Meta>
                        <TouchableOpacity
                            onPress={onCreateTemplate}
                            accessibilityRole={'button'}
                            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                        >
                            <Typography.Meta color={'primary'} weight={'bold'}>
                                {t('newTemplateShort')}
                            </Typography.Meta>
                        </TouchableOpacity>
                    </View>

                    {templates.length === 0 ? (
                        <View style={[styles.empty, { borderColor: theme.border }]}>
                            <Typography.Meta color={'textSecondary'} style={styles.emptyText}>
                                {t('noTemplatesYet')}
                            </Typography.Meta>
                        </View>
                    ) : (
                        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                            {templates.map((summary, index) => (
                                <View
                                    key={summary.template.id}
                                    style={index > 0 && { borderTopWidth: 1, borderTopColor: theme.hairline }}
                                >
                                    <TemplateRow
                                        summary={summary}
                                        trailingIcon={'play'}
                                        disabled={isStarting}
                                        onPress={() => onStartPlanned(summary.template)}
                                        accessibilityHint={t('startPlannedHint')}
                                    />
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    )
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: Radius.lg,
        borderTopRightRadius: Radius.lg,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
        gap: Spacing.md,
        maxHeight: '85%',
    },
    grabberWrap: {
        alignItems: 'center',
        paddingVertical: Spacing.xs,
    },
    grabber: {
        width: 36,
        height: 4,
        borderRadius: Radius.pill,
    },
    title: {
        textAlign: 'center',
    },
    unplanned: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
    },
    disabled: {
        opacity: 0.5,
    },
    icon: {
        width: 36,
        height: 36,
        borderRadius: Radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        flex: 1,
        minWidth: 0,
        gap: Spacing.xs2,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: Spacing.xs,
    },
    sectionLabel: {
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    list: {
        flexGrow: 0,
    },
    empty: {
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: Radius.md,
        padding: Spacing.md,
    },
    emptyText: {
        textAlign: 'center',
    },
})
