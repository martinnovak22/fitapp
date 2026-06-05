import type React from 'react'
import { useTranslation } from 'react-i18next'
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
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

    return (
        <Modal
            visible={visible && !!imageUri}
            transparent={true}
            animationType="fade"
            statusBarTranslucent={true}
            onRequestClose={onClose}
        >
            <View style={[styles.container, { backgroundColor: theme.overlayScrim }]}>
                {imageUri && <Image source={{ uri: imageUri }} style={styles.image} />}

                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={onClose}
                    accessibilityLabel={t('close')}
                    accessibilityRole="button"
                    style={[
                        styles.closeButton,
                        {
                            top: insets.top + Spacing.sm,
                            right: Spacing.sm,
                            backgroundColor: theme.surfaceMuted,
                        },
                    ]}
                >
                    <Text style={[styles.closeText, { color: theme.error }]}>✕</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    container: {
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
        width: 44,
        height: 44,
        borderRadius: Radius.pill,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeText: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
    },
})
