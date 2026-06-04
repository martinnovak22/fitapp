import FontAwesome from '@expo/vector-icons/FontAwesome'
import { StyleSheet, View } from 'react-native'
import Toast, { type ToastConfig, type ToastConfigParams } from 'react-native-toast-message'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { FontSize, FontWeight } from '@/src/constants/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import i18n from '@/src/modules/core/utils/i18n'
import { Button } from './Button'
import { resolveToastVisual, type ToastIcon, type ToastType } from './toastVisual'
import { Typography } from './Typography'

export type { ToastIcon }

export interface ToastAction {
    label: string
    onPress: () => void
}

interface CustomToastExtraProps {
    icon?: ToastIcon
    action?: ToastAction
    tone?: 'info' | 'danger'
}

interface CustomToastProps {
    text1?: string
    text2?: string
    icon: ToastIcon
    iconColor: string
    actionColor: string
    action?: ToastAction
    cancelAction?: ToastAction
}

const CustomToast = ({ text1, text2, icon, iconColor, actionColor, action, cancelAction }: CustomToastProps) => {
    const { theme } = useTheme()
    return (
        <View style={[styles.toastContainer, { backgroundColor: theme.surface, borderColor: `${theme.border}20` }]}>
            <View style={styles.contentRow}>
                <View style={[styles.iconBadge, { backgroundColor: `${iconColor}15` }]}>
                    <FontAwesome name={icon} size={20} color={iconColor} />
                </View>
                <View style={styles.textContainer}>
                    {text1 && (
                        <Typography.Subtitle style={[styles.title, { color: theme.text }]}>{text1}</Typography.Subtitle>
                    )}
                    {text2 && (
                        <Typography.Body style={[styles.message, { color: theme.textSecondary }]}>
                            {text2}
                        </Typography.Body>
                    )}
                </View>
            </View>

            {(action || cancelAction) && (
                <View style={[styles.actionRow, { borderTopColor: `${theme.border}15` }]}>
                    <View style={styles.buttonContainer}>
                        {cancelAction && (
                            <Button
                                label={cancelAction.label}
                                onPress={cancelAction.onPress}
                                variant="text"
                                size="sm"
                                labelStyle={[styles.cancelText, { color: theme.textSecondary }]}
                            />
                        )}
                        {action && (
                            <Button
                                label={action.label}
                                onPress={action.onPress}
                                variant="text"
                                size="sm"
                                labelStyle={[styles.actionText, { color: actionColor }]}
                            />
                        )}
                    </View>
                </View>
            )}
        </View>
    )
}

// One renderer for every toast type: the type-specific look comes from the pure
// resolveToastVisual mapping, and the action/cancel callbacks are wired in only
// where the resolved visual says they belong.
const ToastView = ({ kind, text1, text2, props }: ToastConfigParams<CustomToastExtraProps> & { kind: ToastType }) => {
    const { theme } = useTheme()
    const visual = resolveToastVisual(
        { type: kind, icon: props?.icon, tone: props?.tone },
        { primary: theme.primary, error: theme.error, info: theme.info }
    )
    return (
        <CustomToast
            text1={text1}
            text2={text2}
            icon={visual.icon}
            iconColor={visual.iconColor}
            actionColor={visual.actionColor ?? theme.primary}
            action={visual.supportsAction ? props?.action : undefined}
            cancelAction={visual.supportsCancel ? { label: i18n.t('cancel'), onPress: () => Toast.hide() } : undefined}
        />
    )
}

export const toastConfig: ToastConfig = {
    success: (params) => <ToastView kind="success" {...params} />,
    danger: (params) => <ToastView kind="danger" {...params} />,
    info: (params) => <ToastView kind="info" {...params} />,
    confirm: (params) => <ToastView kind="confirm" {...params} />,
}

const styles = StyleSheet.create({
    toastContainer: {
        borderRadius: Spacing.md,
        padding: Spacing.md,
        width: '92%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
        borderWidth: 1,
        marginTop: Spacing.sm,
    },

    contentRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    iconBadge: {
        width: 40,
        height: 40,
        borderRadius: Radius.pill,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
        overflow: 'hidden',
    },
    textContainer: {
        flex: 1,
        paddingTop: 2,
    },
    title: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        marginBottom: 1,
    },

    message: {
        fontSize: FontSize.xs,
        lineHeight: 18,
    },

    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
    },

    buttonContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    actionText: {
        fontWeight: FontWeight.bold,
        fontSize: FontSize.xs,
    },

    cancelText: {
        fontWeight: FontWeight.semibold,
        fontSize: FontSize.xs,
    },
})
