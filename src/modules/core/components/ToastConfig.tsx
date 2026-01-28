import { Theme } from '@/src/constants/Colors';
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
}

interface CustomToastProps {
    text1?: string;
    text2?: string;
    icon: ToastIcon;
    iconColor?: string;
    action?: ToastAction;
    cancelAction?: ToastAction;
}

const CustomToast = ({ text1, text2, icon, iconColor, action, cancelAction }: CustomToastProps) => {
    return (
        <View style={styles.toastContainer}>
            <View style={styles.contentRow}>
                <View style={[styles.iconBadge, { backgroundColor: `${iconColor || Theme.primary}15` }]}>
                    <FontAwesome name={icon} size={20} color={iconColor || Theme.primary} />
                </View>
                <View style={styles.textContainer}>
                    {text1 && <Typography.Subtitle style={styles.title}>{text1}</Typography.Subtitle>}
                    {text2 && <Typography.Body style={styles.message}>{text2}</Typography.Body>}
                </View>
            </View>

            {(action || cancelAction) && (
                <View style={styles.actionRow}>
                    <View style={styles.buttonContainer}>
                        {cancelAction && (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.cancelButton]}
                                onPress={cancelAction.onPress}
                            >
                                <Typography.Meta style={styles.cancelText}>{cancelAction.label}</Typography.Meta>
                            </TouchableOpacity>
                        )}
                        {action && (
                            <TouchableOpacity style={styles.actionButton} onPress={action.onPress}>
                                <Typography.Meta style={styles.actionText}>{action.label}</Typography.Meta>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
};

export const toastConfig: ToastConfig = {
    success: ({ text1, text2, props }: ToastConfigParams<CustomToastExtraProps>) => (
        <CustomToast
            text1={text1}
            text2={text2}
            icon={props?.icon || "check-circle"}
            iconColor={Theme.primary}
        />
    ),
    error: ({ text1, text2, props }: ToastConfigParams<CustomToastExtraProps>) => (
        <CustomToast
            text1={text1}
            text2={text2}
            icon={props?.icon || "exclamation-circle"}
            iconColor={Theme.error}
        />
    ),
    info: ({ text1, text2, props }: ToastConfigParams<CustomToastExtraProps>) => (
        <CustomToast
            text1={text1}
            text2={text2}
            icon={props?.icon || "info-circle"}
            iconColor={Theme.tint}
        />
    ),
    confirm: ({ text1, text2, props }: ToastConfigParams<CustomToastExtraProps>) => (
        <CustomToast
            text1={text1}
            text2={text2}
            icon={props?.icon || "info-circle"}
            iconColor={Theme.tint}
            action={props?.action}
            cancelAction={{
                label: 'Cancel',
                onPress: () => Toast.hide()
            }}
        />
    )
};

const styles = StyleSheet.create({
    toastContainer: {
        backgroundColor: Theme.surface,
        borderRadius: 16,
        padding: 12,
        width: '92%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        marginTop: 8,
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
        marginRight: 12,
        overflow: 'hidden',
    },
    textContainer: {
        flex: 1,
        paddingTop: 2,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: Theme.text,
        marginBottom: 1,
    },
    message: {
        fontSize: 13,
        color: Theme.textSecondary,
        lineHeight: 18,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    buttonContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    actionButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        marginLeft: 8,
    },
    cancelButton: {
        backgroundColor: 'transparent',
        paddingHorizontal: 8,
    },
    actionText: {
        color: Theme.text,
        fontWeight: '700',
        fontSize: 13,
    },
    cancelText: {
        color: Theme.textSecondary,
        fontWeight: '600',
        fontSize: 13,
    },
});
