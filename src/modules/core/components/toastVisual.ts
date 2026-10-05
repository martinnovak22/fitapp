import type FontAwesome from '@expo/vector-icons/FontAwesome'
import type { ComponentProps } from 'react'

export type ToastIcon = ComponentProps<typeof FontAwesome>['name']

export type ToastType = 'success' | 'danger' | 'info'

// The three theme colors the toast styling chooses between.
export type ToastPalette = {
    primary: string
    error: string
    info: string
}

export type ToastVisualInput = {
    type: ToastType
    icon?: ToastIcon
}

// The resolved look of a toast: which icon and tint to use, and whether this
// kind of toast renders an action button at all.
export type ToastVisual = {
    icon: ToastIcon
    iconColor: string
    actionColor: string | undefined
    supportsAction: boolean
}

// Pure mapping from a toast's type/props to its display. The three toast kinds
// share one renderer; their only differences are captured here. Confirmations
// are a ConfirmDialog, never a toast.
export const resolveToastVisual = ({ type, icon }: ToastVisualInput, palette: ToastPalette): ToastVisual => {
    switch (type) {
        case 'success':
            return {
                icon: icon ?? 'check-circle',
                iconColor: palette.primary,
                actionColor: undefined,
                supportsAction: false,
            }
        case 'danger':
            return {
                icon: icon ?? 'info-circle',
                iconColor: palette.error,
                actionColor: undefined,
                supportsAction: false,
            }
        case 'info':
            return {
                icon: icon ?? 'info-circle',
                iconColor: palette.info,
                actionColor: palette.info,
                supportsAction: true,
            }
    }
}
