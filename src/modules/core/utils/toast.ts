import Toast from 'react-native-toast-message';
import { ToastAction, ToastIcon } from '../components/ToastConfig';

export type ToastOptions = {
    title: string;
    message: string;
    icon?: ToastIcon;
}

export type ConfirmToastOptions = ToastOptions & {
    action: ToastAction;
}

export const showToast = {
    success: (options: ToastOptions) => {
        Toast.show({
            type: 'success',
            text1: options.title,
            text2: options.message,
            props: { icon: options.icon }
        });
    },
    danger: (options: ToastOptions) => {
        Toast.show({
            type: 'danger',
            text1: options.title,
            text2: options.message,
            props: { icon: options.icon }
        });
    },
    info: (options: ToastOptions) => {
        Toast.show({
            type: 'info',
            text1: options.title,
            text2: options.message,
            props: { icon: options.icon }
        });
    },
    confirm: (options: ConfirmToastOptions) => {
        Toast.show({
            type: 'confirm',
            text1: options.title,
            text2: options.message,
            props: {
                icon: options.icon,
                action: {
                    label: options.action.label,
                    onPress: () => {
                        options.action.onPress();
                        Toast.hide();
                    }
                }
            },
            autoHide: false,
        });
    },
    hide: () => Toast.hide(),
};
