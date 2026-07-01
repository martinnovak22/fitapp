import FontAwesome from '@expo/vector-icons/FontAwesome'
import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Spacing } from '@/src/constants/Spacing'
import { findDuplicateExercises, getExerciseSetCounts, mergeDuplicateExercises } from '@/src/data/dedup/mergeExercises'
import {
    initReviewItems,
    isReviewComplete,
    mergeInputFor,
    type ReviewItem,
    resolveItem,
    setSurvivor,
} from '@/src/data/dedup/reviewState'
import { runSync } from '@/src/data/sync/syncService'
import { Button } from '@/src/modules/core/components/Button'
import { Card } from '@/src/modules/core/components/Card'
import { Appear } from '@/src/modules/core/components/motion'
import { ScrollScreenLayout } from '@/src/modules/core/components/ScreenLayout'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { log } from '@/src/modules/core/utils/logger'

// The de-duplication review step in the guest→account sign-in flow (ADR-0005).
// The sign-in flow routes here after a preserve merge only when duplicates
// exist; when every group is resolved (merged or skipped) it lands the user.
export default function MergeReviewScreen() {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const insets = useSafeAreaInsets()
    const [items, setItems] = useState<ReviewItem[] | null>(null)
    const [setCounts, setSetCounts] = useState<ReadonlyMap<number, number>>(new Map())
    const [busyIndex, setBusyIndex] = useState<number | null>(null)

    useEffect(() => {
        let active = true
        const load = async () => {
            try {
                // Pull the account's rows first so guest-vs-account overlaps are
                // visible; a failed pull (e.g. offline) still lets detection run
                // over whatever is already local.
                try {
                    await runSync()
                } catch (syncError) {
                    log('warn', 'Post-merge sync before duplicate detection failed', syncError)
                }
                const [groups, counts] = await Promise.all([findDuplicateExercises(), getExerciseSetCounts()])
                if (!active) return
                setSetCounts(counts)
                setItems(initReviewItems(groups))
            } catch (error) {
                log('error', 'Failed to load duplicate exercises', error)
                if (active) router.replace('/landing')
            }
        }
        void load()
        return () => {
            active = false
        }
    }, [])

    // Land once nothing is left to review (empty result, or all groups resolved).
    // If any merge happened, flush a sync first so the deletion tombstones reach
    // the server before the user can sign out (which clears pending tombstones
    // and would otherwise let the merged-away rows resurface next login).
    const mergedAnyRef = useRef(false)
    const [finishing, setFinishing] = useState(false)
    useEffect(() => {
        if (!items || (items.length > 0 && !isReviewComplete(items))) return
        if (finishing) return
        setFinishing(true)
        void (async () => {
            if (mergedAnyRef.current) {
                try {
                    await runSync()
                } catch (error) {
                    log('warn', 'Post-merge sync flush failed', error)
                }
            }
            router.replace('/landing')
        })()
    }, [items, finishing])

    const chooseSurvivor = useCallback((index: number, survivorId: number) => {
        setItems((current) => (current ? setSurvivor(current, index, survivorId) : current))
    }, [])

    const mergeGroup = useCallback(
        async (index: number) => {
            if (!items || busyIndex !== null) return
            setBusyIndex(index)
            try {
                await mergeDuplicateExercises(mergeInputFor(items[index]))
                mergedAnyRef.current = true
                setItems((current) => (current ? resolveItem(current, index, 'merged') : current))
            } catch (error) {
                log('error', 'Failed to merge duplicate exercise group', error)
            } finally {
                setBusyIndex(null)
            }
        },
        [busyIndex, items]
    )

    const skipGroup = useCallback((index: number) => {
        setItems((current) => (current ? resolveItem(current, index, 'skipped') : current))
    }, [])

    if (!items || finishing) {
        return (
            <View style={[styles.loading, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                <ActivityIndicator color={theme.primary} />
                <Typography.Meta style={{ color: theme.textSecondary }}>
                    {finishing ? t('dedupFinishing') : t('dedupChecking')}
                </Typography.Meta>
            </View>
        )
    }

    return (
        <ScrollScreenLayout
            contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.xl }}
        >
            <Appear variant="down">
                <Typography.Title style={styles.title}>{t('dedupTitle')}</Typography.Title>
                <Typography.Meta style={styles.description}>{t('dedupDescription')}</Typography.Meta>
            </Appear>

            {items.map((item, index) => {
                if (item.status !== 'pending') return null
                return (
                    <Appear key={item.normalizedName} variant="down" delayMs={60}>
                        <Card style={styles.groupCard}>
                            {item.members.map((member) => {
                                const isSurvivor = member.id === item.survivorId
                                const meta = [member.type, member.muscle_group].filter(Boolean).join(' · ')
                                return (
                                    <TouchableOpacity
                                        key={member.id}
                                        style={[
                                            styles.memberRow,
                                            { borderColor: isSurvivor ? theme.primary : theme.border },
                                        ]}
                                        onPress={() => chooseSurvivor(index, member.id)}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: isSurvivor }}
                                    >
                                        <View style={styles.memberInfo}>
                                            <Typography.Body style={{ color: theme.text }}>
                                                {member.name}
                                            </Typography.Body>
                                            <Typography.Meta style={{ color: theme.textSecondary }}>
                                                {meta}
                                                {meta ? ' · ' : ''}
                                                {t('dedupSetsCount', { count: setCounts.get(member.id) ?? 0 })}
                                            </Typography.Meta>
                                        </View>
                                        {isSurvivor && (
                                            <View style={styles.keepBadge}>
                                                <FontAwesome name="check" size={14} color={theme.primary} />
                                                <Typography.Meta style={{ color: theme.primary }}>
                                                    {t('dedupKeepLabel')}
                                                </Typography.Meta>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                )
                            })}

                            <View style={styles.actions}>
                                <Button
                                    label={t('dedupSkip')}
                                    variant="secondary"
                                    size="sm"
                                    onPress={() => skipGroup(index)}
                                    disabled={busyIndex !== null}
                                    style={styles.actionButton}
                                />
                                <Button
                                    label={t('dedupMerge')}
                                    size="sm"
                                    onPress={() => mergeGroup(index)}
                                    isLoading={busyIndex === index}
                                    disabled={busyIndex !== null}
                                    style={styles.actionButton}
                                />
                            </View>
                        </Card>
                    </Appear>
                )
            })}
        </ScrollScreenLayout>
    )
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.md,
    },
    title: {
        marginBottom: Spacing.sm,
    },
    description: {
        marginBottom: Spacing.lg,
    },
    groupCard: {
        gap: Spacing.sm,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderRadius: 12,
        padding: Spacing.md,
    },
    memberInfo: {
        flex: 1,
        gap: 2,
    },
    keepBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: Spacing.sm,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: Spacing.sm,
        marginTop: Spacing.xs,
    },
    actionButton: {
        minWidth: 96,
    },
})
