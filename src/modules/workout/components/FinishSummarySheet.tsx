import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, TextInput, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontSize } from '@/src/constants/Typography'
import { Button } from '@/src/modules/core/components/Button'
import { Sheet } from '@/src/modules/core/components/Sheet'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { TEMPLATE_NAME_MAX_LENGTH } from '@/src/modules/templates/templateForm'

export type WorkoutSummary = {
    durationMinutes: number
    setCount: number
    volumeKg: number
    records: number
}

type FinishSummarySheetProps = {
    visible: boolean
    onClose: () => void
    summary: WorkoutSummary | null
    // Offered for an Unplanned Workout only: a Planned Workout already has its Template.
    canSaveAsTemplate: boolean
    defaultTemplateName: string
    onSaveAsTemplate: (name: string) => Promise<boolean>
}

// The end of a Workout: what was done, any new records, and for a free
// workout a one-step save as a Workout Template.
export function FinishSummarySheet({
    visible,
    onClose,
    summary,
    canSaveAsTemplate,
    defaultTemplateName,
    onSaveAsTemplate,
}: FinishSummarySheetProps) {
    const { t, i18n } = useTranslation()
    const { theme } = useTheme()
    const [templateName, setTemplateName] = useState(defaultTemplateName)
    const [isSaving, setIsSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        if (!visible) return
        setTemplateName(defaultTemplateName)
        setSaved(false)
    }, [defaultTemplateName, visible])

    const save = async () => {
        const name = templateName.trim()
        if (!name || isSaving) return
        setIsSaving(true)
        const ok = await onSaveAsTemplate(name)
        setIsSaving(false)
        if (ok) setSaved(true)
    }

    const stats = summary
        ? [
              {
                  key: 'duration',
                  value: t('minutesShort', { count: summary.durationMinutes }),
                  label: t('statDuration'),
              },
              { key: 'sets', value: String(summary.setCount), label: t('statSets') },
              {
                  key: 'volume',
                  value: `${Math.round(summary.volumeKg).toLocaleString(i18n.language)} ${t('kg')}`,
                  label: t('statVolume'),
              },
              { key: 'records', value: String(summary.records), label: t('statRecords') },
          ]
        : []

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={t('workoutFinished')}
            footer={<Button label={t('done')} onPress={onClose} />}
        >
            <View style={styles.content}>
                <View style={[styles.stats, { backgroundColor: theme.inputBackground }]}>
                    {stats.map((stat) => (
                        <View key={stat.key} style={styles.stat}>
                            <Typography.Subtitle numeric numberOfLines={1}>
                                {stat.value}
                            </Typography.Subtitle>
                            <Typography.Meta color={'textSecondary'}>{stat.label}</Typography.Meta>
                        </View>
                    ))}
                </View>

                {canSaveAsTemplate &&
                    (saved ? (
                        <View style={styles.saved}>
                            <FontAwesome name={'check'} size={14} color={theme.primary} />
                            <Typography.Body>{t('savedAsPlan')}</Typography.Body>
                        </View>
                    ) : (
                        <View style={styles.templateRow}>
                            <TextInput
                                value={templateName}
                                onChangeText={setTemplateName}
                                maxLength={TEMPLATE_NAME_MAX_LENGTH}
                                placeholder={t('templateNamePlaceholder')}
                                placeholderTextColor={theme.textSecondary}
                                selectionColor={theme.primary}
                                style={[
                                    styles.templateInput,
                                    { color: theme.text, backgroundColor: theme.inputBackground },
                                ]}
                                accessibilityLabel={t('templateName')}
                            />
                            <Button
                                label={t('saveAsPlan')}
                                variant={'secondary'}
                                onPress={save}
                                isLoading={isSaving}
                                disabled={templateName.trim().length === 0}
                            />
                        </View>
                    ))}
            </View>
        </Sheet>
    )
}

const styles = StyleSheet.create({
    content: {
        gap: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    stats: {
        flexDirection: 'row',
        borderRadius: Radius.md,
        paddingVertical: Spacing.md,
    },
    stat: {
        flex: 1,
        alignItems: 'center',
        gap: Spacing.xs2,
    },
    // The name field and its button share one height.
    templateRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        alignItems: 'stretch',
    },
    templateInput: {
        flex: 1,
        minHeight: 48,
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.md,
        fontSize: FontSize.md,
    },
    saved: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        minHeight: 48,
    },
})
