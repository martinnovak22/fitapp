import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import { useExerciseRepo, useWorkoutTemplateRepo } from '@/src/data/RepositoryContext'
import { Button } from '@/src/modules/core/components/Button'
import { InitialsAvatar } from '@/src/modules/core/components/InitialsAvatar'
import { ListRow } from '@/src/modules/core/components/ListRow'
import { ListSection } from '@/src/modules/core/components/ListSection'
import { ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { log } from '@/src/modules/core/utils/logger'
import { summarizeTemplates, type TemplateSummary, templateSubtitle } from '../templateSummary'

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/workout'))

// Every plan as a row (name · exercise count · muscle groups) that opens its
// editor; New in the top app bar.
export default function TemplatesListScreen() {
    const templateRepo = useWorkoutTemplateRepo()
    const exerciseRepo = useExerciseRepo()
    const { t } = useTranslation()
    const { theme } = useTheme()
    const navigation = useNavigation()
    const [templates, setTemplates] = useState<TemplateSummary[] | null>(null)

    useFocusEffect(
        useCallback(() => {
            let cancelled = false
            Promise.all([templateRepo.getAll(), exerciseRepo.getAll()])
                .then(([all, exercises]) => {
                    if (!cancelled) setTemplates(summarizeTemplates(all, exercises))
                })
                .catch((error) => log('error', 'Failed to load plans', error))
            return () => {
                cancelled = true
            }
        }, [exerciseRepo, templateRepo])
    )

    const openNew = useCallback(() => router.push('/(tabs)/workout/templates/new'), [])

    useFocusEffect(
        useCallback(() => {
            navigation.getParent()?.setOptions({
                headerTitle: t('plans'),
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
                    <Button label={t('new')} variant={'text'} onPress={openNew} style={styles.headerButton} />
                ),
            })
        }, [navigation, openNew, t, theme])
    )

    return (
        <ScrollScreenLayout contentContainerStyle={styles.content}>
            {templates && templates.length === 0 ? (
                <View style={styles.empty}>
                    <Typography.Body color={'textSecondary'} style={styles.emptyText}>
                        {t('plansEmptyHint')}
                    </Typography.Body>
                    <Button label={t('newTemplate')} leftIcon={'plus'} variant={'secondary'} onPress={openNew} />
                </View>
            ) : (
                <ListSection footer={t('templateExercisesHint')}>
                    {(templates ?? []).map((summary) => (
                        <ListRow
                            key={summary.template.id}
                            label={summary.template.name}
                            subtitle={templateSubtitle(t, summary)}
                            leading={<InitialsAvatar name={summary.template.name} />}
                            accessory={'chevron'}
                            onPress={() => router.push(`/(tabs)/workout/templates/${summary.template.id}`)}
                            accessibilityHint={t('editTemplate')}
                        />
                    ))}
                </ListSection>
            )}
        </ScrollScreenLayout>
    )
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: Spacing.xl,
    },
    empty: {
        gap: Spacing.md,
        paddingTop: Spacing.lg,
    },
    emptyText: {
        textAlign: 'center',
    },
    headerBack: {
        paddingLeft: Spacing.md,
        paddingRight: Spacing.sm,
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
    },
    headerButton: {
        minHeight: 44,
        paddingHorizontal: Spacing.md,
    },
})
