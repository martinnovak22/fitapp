import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Image, StyleSheet, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Portal } from 'react-native-teleport'
import { Button } from './Button'
import { Appear } from './motion'
import { useTheme } from '../hooks/useTheme'

interface FullScreenImageModalProps {
    visible: boolean
    onClose: () => void
    imageUri: string | null
}

export const FullScreenImageModal: React.FC<FullScreenImageModalProps> = ({ visible, onClose, imageUri }) => {
    const insets = useSafeAreaInsets()
    const { theme } = useTheme()
    const { t } = useTranslation()

    // Portal stays mounted so toggling the inner Appear plays both the fade-in
    // (open) and fade-out (close) instead of an instant mount/unmount.
    return (
        <Portal hostName="overlay">
            {visible && imageUri ? (
                <Appear variant="fade" style={[styles.container, { backgroundColor: theme.overlayScrim }]}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                    <Image source={{ uri: imageUri }} style={styles.image} />
                    <Button
                        leftIcon={'close'}
                        onPress={onClose}
                        variant={'text'}
                        accessibilityLabel={t('close')}
                        labelStyle={{ color: theme.error }}
                        style={[
                            styles.closeButton,
                            {
                                top: insets.top + Spacing.sm,
                                right: Spacing.sm,
                                backgroundColor: theme.surfaceMuted,
                            },
                        ]}
                    />
                </Appear>
            ) : null}
        </Portal>
    )
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain',
    },
    closeButton: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: Radius.pill,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
})
