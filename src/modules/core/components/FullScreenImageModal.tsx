import { Spacing } from '@/src/constants/Spacing';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { Image, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FullScreenImageModalProps {
    visible: boolean;
    onClose: () => void;
    imageUri: string | null;
}

export const FullScreenImageModal: React.FC<FullScreenImageModalProps> = ({ visible, onClose, imageUri }) => {
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();

    if (!imageUri) return null;

    return (
        <Modal
            visible={visible}
            onRequestClose={onClose}
            animationType="fade"
            transparent={false}
        >
            <View style={[styles.container, { backgroundColor: theme.overlayScrim }]}>
                <Image source={{ uri: imageUri }} style={styles.image} />
                <TouchableOpacity
                    onPress={onClose}
                    style={[
                        styles.closeButton,
                        {
                            top: insets.top + Spacing.sm,
                            right: Spacing.sm,
                            backgroundColor: theme.surfaceMuted,
                        }
                    ]}
                >
                    <FontAwesome name={"close"} size={20} color={theme.error} />
                </TouchableOpacity>
            </View>
        </Modal>
    );
};

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
        width: 40,
        height: 40,
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
});
