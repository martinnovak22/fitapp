import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { useTheme } from '../hooks/useTheme'
import { Button } from './Button'
import { type ConfirmRequest, createConfirmStore } from './confirmStore'
import { Typography } from './Typography'

const store = createConfirmStore()

// Asks before a destructive or irreversible action. The message should say
// what will be lost. Rendered by the single ConfirmDialogHost.
export const confirmDialog = (request: ConfirmRequest) => store.show(request)

// Mount once, near the root. A centred dialog: Cancel on the leading edge and
// the action on the trailing edge, kept far apart so a sweaty thumb can't hit
// the wrong one.
export function ConfirmDialogHost() {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const [request, setRequest] = useState<ConfirmRequest | null>(store.current())

    useEffect(() => store.subscribe(setRequest), [])

    // Keep the last request on screen while the modal fades out.
    const lastRequest = useRef(request)
    if (request) lastRequest.current = request
    const shown = request ?? lastRequest.current

    return (
        <Modal
            visible={request !== null}
            transparent
            animationType={'fade'}
            onRequestClose={() => store.dismiss(shown ?? undefined)}
            statusBarTranslucent
        >
            <View style={styles.root}>
                <Pressable
                    style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlayScrimLight }]}
                    onPress={() => store.dismiss(shown ?? undefined)}
                    accessibilityRole={'button'}
                    accessibilityLabel={t('cancel')}
                />
                {shown && (
                    <View
                        style={[styles.dialog, { backgroundColor: theme.surface }]}
                        accessibilityViewIsModal
                        accessibilityRole={'alert'}
                    >
                        <View style={styles.text}>
                            <Typography.Subtitle>{shown.title}</Typography.Subtitle>
                            {shown.message && (
                                <Typography.Body color={'textSecondary'}>{shown.message}</Typography.Body>
                            )}
                        </View>
                        <View style={styles.actions}>
                            <Button
                                label={shown.cancelLabel ?? t('cancel')}
                                variant={'text'}
                                onPress={() => store.dismiss(shown)}
                                style={styles.action}
                                labelStyle={{ color: theme.textSecondary }}
                            />
                            <Button
                                label={shown.confirmLabel}
                                variant={'text'}
                                onPress={() => store.confirm(shown)}
                                style={styles.action}
                                labelStyle={shown.destructive ? { color: theme.error } : undefined}
                            />
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    dialog: {
        borderRadius: Radius.lg,
        paddingTop: Spacing.lg,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.sm,
        gap: Spacing.md,
        width: '100%',
        maxWidth: 420,
        alignSelf: 'center',
    },
    text: {
        gap: Spacing.sm,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    action: {
        minHeight: 48,
        paddingHorizontal: Spacing.sm,
    },
})
