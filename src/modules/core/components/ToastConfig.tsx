import { Spacing } from '@/src/constants/Spacing';
import { useTheme } from '@/src/modules/core/hooks/useTheme';
import i18n from '@/src/modules/core/utils/i18n';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React, { ComponentProps } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Toast, { ToastConfig, ToastConfigParams } from 'react-native-toast-message';
import { Typography } from './Typography';


export type ToastIcon = ComponentProps<typeof FontAwesome>['name'];

export interface ToastAction {
    label: string;
    onPress: () => void;
}

export interface CustomToastExtraProps {
    icon?: ToastIcon;
    action?: ToastAction;
    tone?: 'info' | 'danger';
}

interface CustomToastProps {
    text1?: string;
    text2?: string;
    icon: ToastIcon;
    iconColor?: string;
    actionColor?: string;
    action?: ToastAction;
    cancelAction?: ToastAction;
}

const CustomToast = ({ text1, text2, icon, iconColor, actionColor, action, cancelAction }: CustomToastProps) => {
    const { theme } = useTheme();
    const primaryActionColor = actionColor || theme.primary;
    return (
        <View style={[styles.toastContainer, { backgroundColor: theme.surface, borderColor: theme.border + '20' }]}>
            <View style={styles.contentRow}>
                <View style={[styles.iconBadge, { backgroundColor: `${iconColor || theme.primary}15` }]}>
                    <FontAwesome name={icon} size={20} color={iconColor || theme.primary} />
                </View>
                <View style={styles.textContainer}>
                    {text1 && <Typography.Subtitle style={[styles.title, { color: theme.text }]}>{text1}</Typography.Subtitle>}
                    {text2 && <Typography.Body style={[styles.message, { color: theme.textSecondary }]}>{text2}</Typography.Body>}
                </View>
            </View>


            {(action || cancelAction) && (
                <View style={[styles.actionRow, { borderTopColor: theme.border + '15' }]}>
                    <View style={styles.buttonContainer}>
                        {cancelAction && (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.cancelButton, { backgroundColor: 'transparent' }]}
                                onPress={cancelAction.onPress}
                            >
                                <Typography.Meta style={[styles.cancelText, { color: theme.textSecondary }]}>{cancelAction.label}</Typography.Meta>
                            </TouchableOpacity>
                        )}
                        {action && (
                            <TouchableOpacity style={[styles.actionButton, { backgroundColor: primaryActionColor + '20' }]} onPress={action.onPress}>
                                <Typography.Meta style={[styles.actionText, { color: primaryActionColor }]}>{action.label}</Typography.Meta>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}

        </View>
    );
};

export const toastConfig: ToastConfig = {
    success: ({ text1, text2, props }: ToastConfigParams<CustomToastExtraProps>) => {
        const { theme } = useTheme();
        return (
            <CustomToast
                text1={text1}
                text2={text2}
                icon={props?.icon || "check-circle"}
                iconColor={theme.primary}
            />
        );
    },
    danger: ({ text1, text2, props }: ToastConfigParams<CustomToastExtraProps>) => {
        const { theme } = useTheme();
        return (
            <CustomToast
                text1={text1}
                text2={text2}
                icon={props?.icon || "info-circle"}
                iconColor={theme.error}
            />
        );
    },
    info: ({ text1, text2, props }: ToastConfigParams<CustomToastExtraProps>) => {
        const { theme } = useTheme();
        return (
            <CustomToast
                text1={text1}
                text2={text2}
                icon={props?.icon || "info-circle"}
                iconColor={theme.info}
            />
        );
    },

    confirm: ({ text1, text2, props }: ToastConfigParams<CustomToastExtraProps>) => {
        const { theme } = useTheme();
        const isDanger = props?.tone === 'danger';
        const toneColor = isDanger ? theme.error : theme.info;
        return (
            <CustomToast
                text1={text1}
                text2={text2}
                icon={props?.icon || (isDanger ? "trash" : "info-circle")}
                iconColor={toneColor}
                actionColor={toneColor}

                action={props?.action}
                cancelAction={{
                    label: i18n.t('cancel'),
                    onPress: () => Toast.hide()
                }}
            />
        );
    }
};

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
        borderRadius: 20,
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
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 1,
    },

    message: {
        fontSize: 13,
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
    },
    actionButton: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: 8,
        marginLeft: Spacing.sm,
    },

    cancelButton: {
        backgroundColor: 'transparent',
        paddingHorizontal: Spacing.sm,
    },
    actionText: {
        fontWeight: '700',
        fontSize: 13,
    },

    cancelText: {
        fontWeight: '600',
        fontSize: 13,
    },

});
