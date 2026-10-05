import Toast from 'react-native-toast-message'
import type { ToastAction, ToastIcon } from '../components/ToastConfig'

type ToastOptions = {
    title: string
    message: string
    icon?: ToastIcon
}

type ActionToastOptions = ToastOptions & {
    action: ToastAction
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
    hide: () => Toast.hide(),
}
