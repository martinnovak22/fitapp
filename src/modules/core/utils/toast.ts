import Toast from 'react-native-toast-message'
import { ToastAction, ToastIcon } from '../components/ToastConfig'

export type ToastOptions = {
    title: string
    message: string
    icon?: ToastIcon
}

export type ActionToastOptions = ToastOptions & {
    action: ToastAction
}

export type ConfirmToastOptions = ToastOptions & {
    action: ToastAction
    tone?: 'info' | 'danger'
}

export const showToast = {
    success: (options: ToastOptions) => {
        Toast.show({
            type: 'success',
            text1: options.title,
            text2: options.message,
            props: { icon: options.icon },
        })
    },
    danger: (options: ToastOptions) => {
        Toast.show({
            type: 'danger',
            text1: options.title,
            text2: options.message,
            props: { icon: options.icon },
        })
    },
    info: (options: ToastOptions | ActionToastOptions) => {
        const hasAction = 'action' in options
        Toast.show({
            type: 'info',
            text1: options.title,
            text2: options.message,
            props: {
                icon: options.icon,
                action: hasAction
                    ? {
                          label: options.action.label,
                          onPress: () => {
                              options.action.onPress()
                              Toast.hide()
                          },
                      }
                    : undefined,
            },
            autoHide: !hasAction,
        })
    },
    confirm: (options: ConfirmToastOptions) => {
        Toast.show({
            type: 'confirm',
            text1: options.title,
            text2: options.message,
            props: {
                icon: options.icon,
                tone: options.tone,
                action: {
                    label: options.action.label,
                    onPress: () => {
                        options.action.onPress()
                        Toast.hide()
                    },
                },
            },
            autoHide: false,
        })
    },
    hide: () => Toast.hide(),
}
